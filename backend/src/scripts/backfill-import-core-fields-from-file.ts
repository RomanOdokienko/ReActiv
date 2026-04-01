import fs from "node:fs";
import path from "node:path";
import { db } from "../db/connection";
import { HEADER_ALIASES } from "../import/header-aliases";
import {
  createImportTenantProfiles,
  parseImportTenantId,
  type ImportTenantId,
} from "../import/import-tenants";
import { normalizeVehicleOfferRow } from "../import/normalize-row";
import { resolveColumnMap } from "../import/resolve-column-map";
import { getLatestSuccessfulImportBatch } from "../repositories/import-batch-repository";
import { readExcel } from "../services/excel-reader";

interface CliOptions {
  filePath?: string;
  fileUrl?: string;
  tenantId: ImportTenantId;
  importBatchId?: string;
  dryRun: boolean;
}

interface CoreFieldUpdate {
  offerCode: string;
  status: string;
  mileageKm: number | null;
  price: number | null;
}

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const argsMap = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex < 0) {
      argsMap.set(arg.slice(2), "true");
      continue;
    }
    argsMap.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
  }

  const filePathRaw = argsMap.get("file")?.trim();
  const fileUrlRaw = argsMap.get("fileUrl")?.trim();
  if (!filePathRaw && !fileUrlRaw) {
    throw new Error("Missing required source. Use --file=/path/to/file.xlsx or --fileUrl=https://...");
  }

  const tenantRaw = argsMap.get("tenant") ?? "alpha";
  const tenantId = parseImportTenantId(tenantRaw);
  if (!tenantId) {
    throw new Error(`Invalid --tenant value: ${tenantRaw}`);
  }

  const importBatchId = argsMap.get("batchId");
  const dryRun = argsMap.get("dryRun") === "true";

  return {
    filePath: filePathRaw ? path.resolve(filePathRaw) : undefined,
    fileUrl: fileUrlRaw || undefined,
    tenantId,
    importBatchId: importBatchId?.trim() || undefined,
    dryRun,
  };
}

async function loadFileBuffer(input: CliOptions): Promise<Buffer> {
  if (input.filePath) {
    return fs.readFileSync(input.filePath);
  }

  if (!input.fileUrl) {
    throw new Error("No file source provided");
  }

  const response = await fetch(input.fileUrl, {
    method: "GET",
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Failed to download file from URL: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Downloaded file is empty");
  }

  return buffer;
}

function buildUpdatesFromFile(fileBuffer: Buffer, tenantId: ImportTenantId): CoreFieldUpdate[] {
  const parsedWorkbook = readExcel(fileBuffer);
  const tenantProfiles = createImportTenantProfiles(HEADER_ALIASES);
  const tenantProfile = tenantProfiles[tenantId];

  const columnMap = resolveColumnMap(
    parsedWorkbook.headers,
    tenantProfile.headerAliases,
    parsedWorkbook.rows,
  );

  // eslint-disable-next-line no-console
  console.log("column_map_missing_required_fields", columnMap.missingRequiredFields);

  const updatesByOfferCode = new Map<string, CoreFieldUpdate>();
  const duplicateOfferCodes = new Set<string>();

  for (const row of parsedWorkbook.rows) {
    const normalized = normalizeVehicleOfferRow(row, columnMap.fieldToColumnIndex, {
      offerCodeNormalizer: tenantProfile.offerCodeNormalizer,
      tenantId,
    });

    const offerCode = normalized.offer_code?.trim();
    if (!offerCode) {
      continue;
    }

    if (updatesByOfferCode.has(offerCode)) {
      duplicateOfferCodes.add(offerCode);
      continue;
    }

    updatesByOfferCode.set(offerCode, {
      offerCode,
      status: normalized.status ?? "",
      mileageKm: normalized.mileage_km,
      price: normalized.price,
    });
  }

  if (duplicateOfferCodes.size > 0) {
    // eslint-disable-next-line no-console
    console.warn("duplicate_offer_codes_skipped", {
      count: duplicateOfferCodes.size,
      sample: Array.from(duplicateOfferCodes).slice(0, 20),
    });
  }

  return Array.from(updatesByOfferCode.values());
}

function resolveTargetBatchId(
  tenantId: ImportTenantId,
  explicitBatchId?: string,
): string {
  if (explicitBatchId) {
    return explicitBatchId;
  }

  const latestBatch = getLatestSuccessfulImportBatch(tenantId);
  if (!latestBatch) {
    throw new Error(`No successful import batch found for tenant=${tenantId}`);
  }

  return latestBatch.id;
}

function runBackfill(
  tenantId: ImportTenantId,
  importBatchId: string,
  updates: CoreFieldUpdate[],
  dryRun: boolean,
): {
  updatedOffers: number;
  updatedSnapshots: number;
  matchedOfferCodes: number;
} {
  const updateOffersStatement = db.prepare(`
    UPDATE vehicle_offers
    SET
      status = @status,
      mileage_km = @mileage_km,
      price = @price
    WHERE tenant_id = @tenant_id
      AND import_batch_id = @import_batch_id
      AND offer_code = @offer_code
  `);

  const updateSnapshotsStatement = db.prepare(`
    UPDATE vehicle_offer_snapshots
    SET
      status = @status,
      mileage_km = @mileage_km,
      price = @price
    WHERE tenant_id = @tenant_id
      AND import_batch_id = @import_batch_id
      AND offer_code = @offer_code
  `);

  const existsInBatchStatement = db.prepare(`
    SELECT 1
    FROM vehicle_offers
    WHERE tenant_id = ?
      AND import_batch_id = ?
      AND offer_code = ?
    LIMIT 1
  `);

  const matchedOfferCodes = updates.reduce((count, item) => {
    const exists = existsInBatchStatement.get(
      tenantId,
      importBatchId,
      item.offerCode,
    ) as { 1: number } | undefined;
    return count + (exists ? 1 : 0);
  }, 0);

  if (dryRun) {
    return {
      updatedOffers: 0,
      updatedSnapshots: 0,
      matchedOfferCodes,
    };
  }

  return db.transaction(() => {
    let updatedOffers = 0;
    let updatedSnapshots = 0;

    for (const item of updates) {
      const params = {
        tenant_id: tenantId,
        import_batch_id: importBatchId,
        offer_code: item.offerCode,
        status: item.status,
        mileage_km: item.mileageKm,
        price: item.price,
      };

      updatedOffers += updateOffersStatement.run(params).changes;
      updatedSnapshots += updateSnapshotsStatement.run(params).changes;
    }

    return {
      updatedOffers,
      updatedSnapshots,
      matchedOfferCodes,
    };
  })();
}

async function main(): Promise<void> {
  const options = parseCliOptions();
  const targetBatchId = resolveTargetBatchId(options.tenantId, options.importBatchId);
  const fileBuffer = await loadFileBuffer(options);
  const updates = buildUpdatesFromFile(fileBuffer, options.tenantId);
  const result = runBackfill(
    options.tenantId,
    targetBatchId,
    updates,
    options.dryRun,
  );

  // eslint-disable-next-line no-console
  console.log("backfill_import_core_fields_result", {
    tenantId: options.tenantId,
    filePath: options.filePath ?? null,
    fileUrl: options.fileUrl ?? null,
    targetBatchId,
    dryRun: options.dryRun,
    preparedUpdates: updates.length,
    matchedOfferCodes: result.matchedOfferCodes,
    updatedOffers: result.updatedOffers,
    updatedSnapshots: result.updatedSnapshots,
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("backfill_import_core_fields_failed", error);
  process.exitCode = 1;
});
