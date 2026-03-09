import { db } from "../db/connection";

export interface ImportBatchRecord {
  id: string;
  tenant_id: string;
  filename: string;
  status: "completed" | "completed_with_errors" | "failed";
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  added_rows: number;
  updated_rows: number;
  removed_rows: number;
  unchanged_rows: number;
  created_at: string;
}

export interface ClearImportedDataResult {
  importBatchesDeleted: number;
  importErrorsDeleted: number;
  vehicleOffersDeleted: number;
  vehicleOfferSnapshotsDeleted: number;
}

interface CreateImportBatchInput {
  id: string;
  tenant_id: string;
  filename: string;
  status: ImportBatchRecord["status"];
}

interface UpdateImportBatchSummaryInput {
  id: string;
  status: ImportBatchRecord["status"];
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  added_rows: number;
  updated_rows: number;
  removed_rows: number;
  unchanged_rows: number;
}

export function createImportBatch(input: CreateImportBatchInput): void {
  db.prepare(
    `
      INSERT INTO import_batches (id, tenant_id, filename, status, total_rows, imported_rows, skipped_rows)
      VALUES (@id, @tenant_id, @filename, @status, 0, 0, 0)
    `,
  ).run(input);
}

export function updateImportBatchSummary(
  input: UpdateImportBatchSummaryInput,
): void {
  db.prepare(
    `
      UPDATE import_batches
      SET status = @status,
          total_rows = @total_rows,
          imported_rows = @imported_rows,
          skipped_rows = @skipped_rows,
          added_rows = @added_rows,
          updated_rows = @updated_rows,
          removed_rows = @removed_rows,
          unchanged_rows = @unchanged_rows
      WHERE id = @id
    `,
  ).run(input);
}

export function getImportBatchById(id: string): ImportBatchRecord | null {
  const row = db
    .prepare(
      `
        SELECT
          id,
          tenant_id,
          filename,
          status,
          total_rows,
          imported_rows,
          skipped_rows,
          added_rows,
          updated_rows,
          removed_rows,
          unchanged_rows,
          created_at
        FROM import_batches
        WHERE id = ?
      `,
    )
    .get(id) as ImportBatchRecord | undefined;

  return row ?? null;
}

export function listImportBatches(limit = 20, tenantId?: string): ImportBatchRecord[] {
  if (tenantId) {
    return db
      .prepare(
        `
          SELECT
            id,
            tenant_id,
            filename,
            status,
            total_rows,
            imported_rows,
            skipped_rows,
            added_rows,
            updated_rows,
            removed_rows,
            unchanged_rows,
            created_at
          FROM import_batches
          WHERE tenant_id = ?
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT ?
        `,
      )
      .all(tenantId, limit) as ImportBatchRecord[];
  }

  return db
    .prepare(
      `
        SELECT
          id,
          tenant_id,
          filename,
          status,
          total_rows,
          imported_rows,
          skipped_rows,
          added_rows,
          updated_rows,
          removed_rows,
          unchanged_rows,
          created_at
        FROM import_batches
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ?
      `,
    )
    .all(limit) as ImportBatchRecord[];
}

export function clearImportedData(tenantId?: string): ClearImportedDataResult {
  const deleteVehicleOffers = tenantId
    ? db.prepare(`DELETE FROM vehicle_offers WHERE tenant_id = ?`)
    : db.prepare(`DELETE FROM vehicle_offers`);
  const deleteVehicleOfferSnapshots = tenantId
    ? db.prepare(`DELETE FROM vehicle_offer_snapshots WHERE tenant_id = ?`)
    : db.prepare(`DELETE FROM vehicle_offer_snapshots`);
  const deleteImportErrors = tenantId
    ? db.prepare(`DELETE FROM import_errors WHERE tenant_id = ?`)
    : db.prepare(`DELETE FROM import_errors`);
  const deleteImportBatches = tenantId
    ? db.prepare(`DELETE FROM import_batches WHERE tenant_id = ?`)
    : db.prepare(`DELETE FROM import_batches`);
  const resetSequences = db.prepare(
    `DELETE FROM sqlite_sequence WHERE name IN ('vehicle_offers', 'vehicle_offer_snapshots', 'import_errors')`,
  );

  return db.transaction(() => {
    const vehicleOffersDeleted = tenantId
      ? deleteVehicleOffers.run(tenantId).changes
      : deleteVehicleOffers.run().changes;
    const vehicleOfferSnapshotsDeleted = tenantId
      ? deleteVehicleOfferSnapshots.run(tenantId).changes
      : deleteVehicleOfferSnapshots.run().changes;
    const importErrorsDeleted = tenantId
      ? deleteImportErrors.run(tenantId).changes
      : deleteImportErrors.run().changes;
    const importBatchesDeleted = tenantId
      ? deleteImportBatches.run(tenantId).changes
      : deleteImportBatches.run().changes;
    resetSequences.run();

    return {
      importBatchesDeleted,
      importErrorsDeleted,
      vehicleOffersDeleted,
      vehicleOfferSnapshotsDeleted,
    };
  })();
}

export function getLatestSuccessfulImportBatchId(tenantId?: string): string | null {
  const latestBatch = getLatestSuccessfulImportBatch(tenantId);
  return latestBatch?.id ?? null;
}

export function getLatestSuccessfulImportBatch(tenantId?: string): ImportBatchRecord | null {
  if (tenantId) {
    const row = db
      .prepare(
        `
          SELECT
            id,
            tenant_id,
            filename,
            status,
            total_rows,
            imported_rows,
            skipped_rows,
            added_rows,
            updated_rows,
            removed_rows,
            unchanged_rows,
            created_at
          FROM import_batches
          WHERE status IN ('completed', 'completed_with_errors')
            AND tenant_id = ?
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT 1
        `,
      )
      .get(tenantId) as ImportBatchRecord | undefined;

    return row ?? null;
  }

  const row = db
    .prepare(
      `
        SELECT
          id,
          tenant_id,
          filename,
          status,
          total_rows,
          imported_rows,
          skipped_rows,
          added_rows,
          updated_rows,
          removed_rows,
          unchanged_rows,
          created_at
        FROM import_batches
        WHERE status IN ('completed', 'completed_with_errors')
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 1
      `,
    )
    .get() as ImportBatchRecord | undefined;

  return row ?? null;
}

export function getPreviousSuccessfulImportBatchId(
  excludedImportBatchId: string,
  tenantId?: string,
): string | null {
  if (tenantId) {
    const row = db
      .prepare(
        `
          SELECT id
          FROM import_batches
          WHERE status IN ('completed', 'completed_with_errors')
            AND id != ?
            AND tenant_id = ?
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT 1
        `,
      )
      .get(excludedImportBatchId, tenantId) as { id: string } | undefined;

    return row?.id ?? null;
  }

  const row = db
    .prepare(
      `
        SELECT id
        FROM import_batches
        WHERE status IN ('completed', 'completed_with_errors')
          AND id != ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 1
      `,
    )
    .get(excludedImportBatchId) as { id: string } | undefined;

  return row?.id ?? null;
}
