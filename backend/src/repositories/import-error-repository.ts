import { db } from "../db/connection";

export interface ImportErrorRecord {
  id: number;
  import_batch_id: string;
  row_number: number;
  field: string | null;
  message: string;
  created_at: string;
}

interface InsertImportErrorInput {
  import_batch_id: string;
  row_number: number;
  field: string | null;
  message: string;
}

export function insertImportError(input: InsertImportErrorInput): void {
  db.prepare(
    `
      INSERT INTO import_errors (import_batch_id, row_number, field, message)
      VALUES (@import_batch_id, @row_number, @field, @message)
    `,
  ).run(input);
}

export function getImportErrorsByBatchId(
  importBatchId: string,
): ImportErrorRecord[] {
  return db
    .prepare(
      `
        SELECT id, import_batch_id, row_number, field, message, created_at
        FROM import_errors
        WHERE import_batch_id = ?
        ORDER BY id ASC
      `,
    )
    .all(importBatchId) as ImportErrorRecord[];
}
