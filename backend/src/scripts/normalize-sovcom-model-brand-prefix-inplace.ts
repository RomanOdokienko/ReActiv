import { db } from "../db/connection";
import { initializeSchema } from "../db/schema";
import { buildTitle } from "../import/build-title";
import { normalizeString } from "../import/normalize-string";

const DEFAULT_TENANT_ID = "sovcombank";
const PREVIEW_LIMIT = 20;

interface ScriptOptions {
  apply: boolean;
  tenantId: string;
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
  brand: string | null;
  modelBefore: string | null;
  modelAfter: string | null;
  titleBefore: string | null;
  titleAfter: string;
}

function printUsage(): void {
  console.log(`
Usage:
  npm --prefix backend run normalize-sovcom-models-inplace -- [options]

Options:
  --apply             Apply updates to vehicle_offers (default: dry-run)
  --tenant=<id>       Tenant id (default: sovcombank)
  --limit=<n>         Process only first N rows (for smoke checks)
  --help              Print this help

Notes:
  - Script updates only vehicle_offers.
  - It removes duplicated brand prefix from model, e.g. "Haval Jolion" -> "Jolion".
  - title is rebuilt from (brand, normalized model, modification, offer_code).
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
    tenantId: DEFAULT_TENANT_ID,
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
      if (!value) {
        throw new Error("Invalid --tenant value");
      }
      options.tenantId = value;
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
  const normalized = normalizeString(value);
  return normalized ? normalized : null;
}

function toDbText(value: string | null): string {
  return value ?? "";
}

function comparable(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBrandPrefixFromModel(
  brand: string | null,
  model: string | null,
): string | null {
  if (!brand || !model) {
    return model;
  }

  const trimmedBrand = brand.trim();
  const trimmedModel = model.trim();
  if (!trimmedBrand || !trimmedModel) {
    return model;
  }

  const brandPrefixPattern = new RegExp(
    `^${escapeRegExp(trimmedBrand)}(?:[\\s\\-_/.,:;|]+)(.+)$`,
    "iu",
  );
  const matched = trimmedModel.match(brandPrefixPattern);
  if (!matched) {
    return model;
  }

  const stripped = normalizeString(matched[1]);
  if (!stripped) {
    return model;
  }

  return stripped;
}

function listRowsToProcess(options: ScriptOptions): VehicleOfferRow[] {
  const limitClause = options.limit ? `LIMIT ${options.limit}` : "";

  return db
    .prepare(
      `
        SELECT
          id,
          tenant_id,
          offer_code,
          brand,
          model,
          modification,
          title
        FROM vehicle_offers
        WHERE tenant_id = ?
          AND TRIM(COALESCE(brand, '')) != ''
          AND TRIM(COALESCE(model, '')) != ''
        ORDER BY id ASC
        ${limitClause}
      `,
    )
    .all(options.tenantId) as VehicleOfferRow[];
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    return;
  }

  initializeSchema();

  const rows = listRowsToProcess(options);
  const updates: PlannedUpdate[] = [];
  const previewRows: PlannedUpdate[] = [];

  for (const row of rows) {
    const brand = fromDbText(row.brand);
    const model = fromDbText(row.model);
    const modification = fromDbText(row.modification);
    const offerCode = fromDbText(row.offer_code);

    const normalizedModel = stripBrandPrefixFromModel(brand, model);
    const modelChanged = comparable(normalizedModel) !== comparable(model);
    if (!modelChanged) {
      continue;
    }

    const nextTitle = buildTitle(brand, normalizedModel, modification, offerCode);
    const plannedUpdate: PlannedUpdate = {
      id: row.id,
      tenantId: row.tenant_id,
      offerCode,
      brand,
      modelBefore: model,
      modelAfter: normalizedModel,
      titleBefore: fromDbText(row.title),
      titleAfter: nextTitle,
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
          title = ?
      WHERE id = ?
    `);

    db.transaction(() => {
      updates.forEach((update) => {
        updateStatement.run(toDbText(update.modelAfter), update.titleAfter, update.id);
      });
    })();
  }

  console.log("sovcom_model_brand_prefix_normalization_result", {
    mode: options.apply ? "apply" : "dry-run",
    tenant_id: options.tenantId,
    input_rows: rows.length,
    would_update_rows: updates.length,
    updated_rows: options.apply ? updates.length : 0,
  });

  if (previewRows.length > 0) {
    console.log("sovcom_model_brand_prefix_normalization_preview", previewRows);
  }
}

void run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("sovcom_model_brand_prefix_normalization_failed", { error: message });
  process.exitCode = 1;
});

