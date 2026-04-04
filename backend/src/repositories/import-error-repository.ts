import { db } from "../db/connection";

export interface ImportErrorRecord {
  id: number;
  import_batch_id: string;
  tenant_id: string;
  row_number: number;
  field: string | null;
  message: string;
  created_at: string;
}

export interface ImportErrorSummaryRecord {
  field: string | null;
  message: string;
  count: number;
}

interface InsertImportErrorInput {
  import_batch_id: string;
  tenant_id: string;
  row_number: number;
  field: string | null;
  message: string;
}

export function insertImportError(input: InsertImportErrorInput): void {
  db.prepare(
    `
      INSERT INTO import_errors (import_batch_id, tenant_id, row_number, field, message)
      VALUES (@import_batch_id, @tenant_id, @row_number, @field, @message)
    `,
  ).run(input);
}

export function getImportErrorsByBatchId(
  importBatchId: string,
  options: { limit?: number; offset?: number } = {},
): ImportErrorRecord[] {
  const hasLimit = Number.isFinite(options.limit);
  const limit = hasLimit ? Math.max(0, Math.floor(options.limit as number)) : null;
  const offset = Number.isFinite(options.offset)
    ? Math.max(0, Math.floor(options.offset as number))
    : 0;

  if (limit !== null) {
    return db
      .prepare(
        `
          SELECT id, import_batch_id, tenant_id, row_number, field, message, created_at
          FROM import_errors
          WHERE import_batch_id = ?
          ORDER BY id ASC
          LIMIT ? OFFSET ?
        `,
      )
      .all(importBatchId, limit, offset) as ImportErrorRecord[];
  }

  return db
    .prepare(
      `
        SELECT id, import_batch_id, tenant_id, row_number, field, message, created_at
        FROM import_errors
        WHERE import_batch_id = ?
        ORDER BY id ASC
      `,
    )
    .all(importBatchId) as ImportErrorRecord[];
}

export function countImportErrorsByBatchId(importBatchId: string): number {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM import_errors
        WHERE import_batch_id = ?
      `,
    )
    .get(importBatchId) as { count?: number } | undefined;

  return row?.count ?? 0;
}

export function getImportErrorSummaryByBatchId(
  importBatchId: string,
): ImportErrorSummaryRecord[] {
  return db
    .prepare(
      `
        SELECT
          field,
          message,
          COUNT(*) AS count
        FROM import_errors
        WHERE import_batch_id = ?
        GROUP BY field, message
        ORDER BY count DESC, field ASC, message ASC
      `,
    )
    .all(importBatchId) as ImportErrorSummaryRecord[];
}
