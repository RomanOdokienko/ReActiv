import { db } from "../db/connection";
import { initializeSchema } from "../db/schema";
import { buildTitle } from "../import/build-title";

const DEFAULT_MIN_CONFIDENCE = 0.75;
const PREVIEW_LIMIT = 20;

interface ScriptOptions {
  apply: boolean;
  minConfidence: number;
  tenantIds: string[] | null;
  limit: number | null;
}

interface VehicleOfferRow {
  id: number;
  tenant_id: string;
  offer_code: string;
  brand: string;
  model: string;
  modification: string;
  title: string;
}

interface PlannedUpdate {
  id: number;
  tenantId: string;
  offerCode: string | null;
  modelBefore: string | null;
  modelAfter: string | null;
  modificationBefore: string | null;
  modificationAfter: string | null;
  titleAfter: string;
  confidence: number;
}

function printUsage(): void {
  console.log(`
Usage:
  npm --prefix backend run normalize-catalog-models-inplace -- [options]

Options:
  --apply                      Apply updates to vehicle_offers (default: dry-run)
  --tenant=<csv>               Limit tenants, e.g. --tenant=gpb,alpha
  --min-confidence=<0..1>      Confidence threshold (default: 0.75)
  --limit=<n>                  Process only first N rows (for smoke checks)
  --help                       Print this help

Notes:
  - Script updates only vehicle_offers (current snapshot).
  - vehicle_offer_snapshots are not modified.
  - card_preview_path / has_photo / yandex_disk_url are not touched.
`);
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function parseOptions(argv: string[]): ScriptOptions | null {
  const options: ScriptOptions = {
    apply: false,
    minConfidence: DEFAULT_MIN_CONFIDENCE,
    tenantIds: null,
    limit: null,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printUsage();
      return null;
    }

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }

    if (arg.startsWith("--tenant=")) {
      const value = arg.slice("--tenant=".length).trim();
      const tenantIds = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      options.tenantIds = tenantIds.length > 0 ? tenantIds : null;
      continue;
    }

    if (arg.startsWith("--min-confidence=")) {
      const raw = arg.slice("--min-confidence=".length).trim();
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        throw new Error(`Invalid --min-confidence value: ${raw}`);
      }
      options.minConfidence = Math.floor(parsed * 100) / 100;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const raw = arg.slice("--limit=".length).trim();
      const parsed = parsePositiveInteger(raw);
      if (!parsed) {
        throw new Error(`Invalid --limit value: ${raw}`);
      }
      options.limit = parsed;
      continue;
    }
  }

  return options;
}

function fromDbText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toDbText(value: string | null): string {
  return value ?? "";
}

function comparable(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function listRowsToProcess(options: ScriptOptions): VehicleOfferRow[] {
  const whereParts: string[] = [];
  const params: Array<string | number> = [];

  if (options.tenantIds && options.tenantIds.length > 0) {
    const placeholders = options.tenantIds.map(() => "?").join(", ");
    whereParts.push(`tenant_id IN (${placeholders})`);
    options.tenantIds.forEach((tenantId) => params.push(tenantId));
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const limitClause = options.limit ? `LIMIT ${options.limit}` : "";

  const sql = `
    SELECT
      id,
      tenant_id,
      offer_code,
      brand,
      model,
      modification,
      title
    FROM vehicle_offers
    ${whereClause}
    ORDER BY id ASC
    ${limitClause}
  `;

  return db.prepare(sql).all(...params) as VehicleOfferRow[];
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    return;
  }

  process.env.CATALOG_MODEL_NORMALIZATION_ENABLED = "true";
  process.env.CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE = String(options.minConfidence);

  const { normalizeCatalogModelIdentity } = await import("../import/catalog-model-normalization");

  initializeSchema();

  const rows = listRowsToProcess(options);
  const updates: PlannedUpdate[] = [];
  const previewRows: PlannedUpdate[] = [];

  let ruleMatchedRows = 0;
  let lowConfidenceCandidateRows = 0;

  for (const row of rows) {
    const brand = fromDbText(row.brand);
    const model = fromDbText(row.model);
    const modification = fromDbText(row.modification);
    const offerCode = fromDbText(row.offer_code);

    const normalization = normalizeCatalogModelIdentity({
      brand,
      model,
      modification,
    });

    if (normalization.method === "rule") {
      ruleMatchedRows += 1;
    }

    if (
      normalization.method === "rule" &&
      !normalization.applied &&
      Boolean(normalization.modelFamilyCanonical)
    ) {
      lowConfidenceCandidateRows += 1;
    }

    if (!normalization.applied || !normalization.modelFamilyCanonical) {
      continue;
    }

    const normalizedModel = normalization.modelFamilyCanonical;
    const normalizedModification = normalization.modificationNormalized;
    const nextTitle = buildTitle(brand, normalizedModel, normalizedModification, offerCode);

    const modelChanged = comparable(normalizedModel) !== comparable(model);
    const modificationChanged =
      comparable(normalizedModification) !== comparable(modification);
    const titleChanged = comparable(nextTitle) !== comparable(fromDbText(row.title));

    if (!modelChanged && !modificationChanged && !titleChanged) {
      continue;
    }

    const plannedUpdate: PlannedUpdate = {
      id: row.id,
      tenantId: row.tenant_id,
      offerCode,
      modelBefore: model,
      modelAfter: normalizedModel,
      modificationBefore: modification,
      modificationAfter: normalizedModification,
      titleAfter: nextTitle,
      confidence: normalization.confidence,
    };
    updates.push(plannedUpdate);

    if (previewRows.length < PREVIEW_LIMIT) {
      previewRows.push(plannedUpdate);
    }
  }

  if (options.apply && updates.length > 0) {
    const updateStatement = db.prepare(`
      UPDATE vehicle_offers
      SET model = ?,
          modification = ?,
          title = ?
      WHERE id = ?
    `);

    db.transaction(() => {
      updates.forEach((update) => {
        updateStatement.run(
          toDbText(update.modelAfter),
          toDbText(update.modificationAfter),
          update.titleAfter,
          update.id,
        );
      });
    })();
  }

  const updatesByTenant = updates.reduce<Record<string, number>>((acc, row) => {
    acc[row.tenantId] = (acc[row.tenantId] ?? 0) + 1;
    return acc;
  }, {});

  console.log("catalog_model_normalization_inplace_result", {
    mode: options.apply ? "apply" : "dry-run",
    min_confidence: options.minConfidence,
    tenant_filter: options.tenantIds ?? "all",
    input_rows: rows.length,
    rule_matched_rows: ruleMatchedRows,
    low_confidence_candidate_rows: lowConfidenceCandidateRows,
    would_update_rows: updates.length,
    updated_rows: options.apply ? updates.length : 0,
    updates_by_tenant: updatesByTenant,
  });

  if (previewRows.length > 0) {
    console.log("catalog_model_normalization_inplace_preview", previewRows);
  }
}

void run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("catalog_model_normalization_inplace_failed", { error: message });
  process.exitCode = 1;
});
