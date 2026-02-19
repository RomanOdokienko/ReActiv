import { db } from "../db/connection";

export interface ImportBatchRecord {
  id: string;
  filename: string;
  status: "completed" | "completed_with_errors" | "failed";
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  created_at: string;
}

export interface ClearImportedDataResult {
  importBatchesDeleted: number;
  importErrorsDeleted: number;
  vehicleOffersDeleted: number;
}

interface CreateImportBatchInput {
  id: string;
  filename: string;
  status: ImportBatchRecord["status"];
}

interface UpdateImportBatchSummaryInput {
  id: string;
  status: ImportBatchRecord["status"];
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
}

export function createImportBatch(input: CreateImportBatchInput): void {
  db.prepare(
    `
      INSERT INTO import_batches (id, filename, status, total_rows, imported_rows, skipped_rows)
      VALUES (@id, @filename, @status, 0, 0, 0)
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
          skipped_rows = @skipped_rows
      WHERE id = @id
    `,
  ).run(input);
}

export function getImportBatchById(id: string): ImportBatchRecord | null {
  const row = db
    .prepare(
      `
        SELECT id, filename, status, total_rows, imported_rows, skipped_rows, created_at
        FROM import_batches
        WHERE id = ?
      `,
    )
    .get(id) as ImportBatchRecord | undefined;

  return row ?? null;
}

export function listImportBatches(limit = 20): ImportBatchRecord[] {
  return db
    .prepare(
      `
        SELECT id, filename, status, total_rows, imported_rows, skipped_rows, created_at
        FROM import_batches
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ?
      `,
    )
    .all(limit) as ImportBatchRecord[];
}

export function clearImportedData(): ClearImportedDataResult {
  const deleteVehicleOffers = db.prepare(`DELETE FROM vehicle_offers`);
  const deleteImportErrors = db.prepare(`DELETE FROM import_errors`);
  const deleteImportBatches = db.prepare(`DELETE FROM import_batches`);
  const resetSequences = db.prepare(
    `DELETE FROM sqlite_sequence WHERE name IN ('vehicle_offers', 'import_errors')`,
  );

  return db.transaction(() => {
    const vehicleOffersDeleted = deleteVehicleOffers.run().changes;
    const importErrorsDeleted = deleteImportErrors.run().changes;
    const importBatchesDeleted = deleteImportBatches.run().changes;
    resetSequences.run();

    return {
      importBatchesDeleted,
      importErrorsDeleted,
      vehicleOffersDeleted,
    };
  })();
}
