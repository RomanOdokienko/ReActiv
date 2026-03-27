import { db } from "../db/connection";

export type ImportMediaSyncJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed";

export type ImportMediaSyncJobStage =
  | "queued"
  | "media_enrichment"
  | "preview_sync"
  | "done";

export interface ImportMediaSyncJobRecord {
  id: string;
  import_batch_id: string;
  tenant_id: string;
  trigger_type: string;
  status: ImportMediaSyncJobStatus;
  stage: ImportMediaSyncJobStage;
  processed_count: number;
  total_count: number;
  media_candidates_count: number;
  media_updated_rows: number;
  preview_candidates_count: number;
  preview_updated_rows: number;
  error_message: string | null;
  details_json: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

interface CreateImportMediaSyncJobInput {
  id: string;
  import_batch_id: string;
  tenant_id: string;
  trigger_type: string;
}

interface UpdateImportMediaSyncJobProgressInput {
  id: string;
  stage?: ImportMediaSyncJobStage;
  processed_count?: number;
  total_count?: number;
  media_candidates_count?: number;
  media_updated_rows?: number;
  preview_candidates_count?: number;
  preview_updated_rows?: number;
  error_message?: string | null;
  details_json?: string | null;
}

interface FinishImportMediaSyncJobInput {
  id: string;
  status: Exclude<ImportMediaSyncJobStatus, "queued" | "running">;
  stage?: ImportMediaSyncJobStage;
  processed_count?: number;
  total_count?: number;
  media_candidates_count?: number;
  media_updated_rows?: number;
  preview_candidates_count?: number;
  preview_updated_rows?: number;
  error_message?: string | null;
  details_json?: string | null;
}

function normalizeSqlParam<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

export function createImportMediaSyncJob(input: CreateImportMediaSyncJobInput): void {
  const nowIso = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO import_media_sync_jobs (
        id,
        import_batch_id,
        tenant_id,
        trigger_type,
        status,
        stage,
        processed_count,
        total_count,
        media_candidates_count,
        media_updated_rows,
        preview_candidates_count,
        preview_updated_rows,
        error_message,
        details_json,
        created_at,
        started_at,
        finished_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 'queued', 'queued', 0, 0, 0, 0, 0, 0, NULL, NULL, ?, NULL, NULL, ?)
    `,
  ).run(input.id, input.import_batch_id, input.tenant_id, input.trigger_type, nowIso, nowIso);
}

export function getImportMediaSyncJobById(id: string): ImportMediaSyncJobRecord | null {
  const row = db
    .prepare(
      `
        SELECT *
        FROM import_media_sync_jobs
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id) as ImportMediaSyncJobRecord | undefined;

  return row ?? null;
}

export function getLatestImportMediaSyncJobByImportBatchId(
  importBatchId: string,
): ImportMediaSyncJobRecord | null {
  const row = db
    .prepare(
      `
        SELECT *
        FROM import_media_sync_jobs
        WHERE import_batch_id = ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 1
      `,
    )
    .get(importBatchId) as ImportMediaSyncJobRecord | undefined;

  return row ?? null;
}

export function getNextQueuedImportMediaSyncJobForTenant(
  tenantId: string,
): ImportMediaSyncJobRecord | null {
  const row = db
    .prepare(
      `
        SELECT *
        FROM import_media_sync_jobs
        WHERE tenant_id = ?
          AND status = 'queued'
        ORDER BY datetime(created_at) ASC, id ASC
        LIMIT 1
      `,
    )
    .get(tenantId) as ImportMediaSyncJobRecord | undefined;

  return row ?? null;
}

export function hasRunningImportMediaSyncJobForTenant(tenantId: string): boolean {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM import_media_sync_jobs
        WHERE tenant_id = ?
          AND status = 'running'
      `,
    )
    .get(tenantId) as { total: number };

  return row.total > 0;
}

export function markImportMediaSyncJobRunning(
  id: string,
  stage: ImportMediaSyncJobStage,
): void {
  const nowIso = new Date().toISOString();
  db.prepare(
    `
      UPDATE import_media_sync_jobs
      SET status = 'running',
          stage = ?,
          started_at = COALESCE(started_at, ?),
          updated_at = ?,
          error_message = NULL,
          finished_at = NULL
      WHERE id = ?
    `,
  ).run(stage, nowIso, nowIso, id);
}

export function updateImportMediaSyncJobProgress(
  input: UpdateImportMediaSyncJobProgressInput,
): void {
  const nowIso = new Date().toISOString();
  db.prepare(
    `
      UPDATE import_media_sync_jobs
      SET stage = COALESCE(@stage, stage),
          processed_count = COALESCE(@processed_count, processed_count),
          total_count = COALESCE(@total_count, total_count),
          media_candidates_count = COALESCE(@media_candidates_count, media_candidates_count),
          media_updated_rows = COALESCE(@media_updated_rows, media_updated_rows),
          preview_candidates_count = COALESCE(@preview_candidates_count, preview_candidates_count),
          preview_updated_rows = COALESCE(@preview_updated_rows, preview_updated_rows),
          error_message = COALESCE(@error_message, error_message),
          details_json = COALESCE(@details_json, details_json),
          updated_at = @updated_at
      WHERE id = @id
    `,
  ).run({
    id: input.id,
    stage: normalizeSqlParam(input.stage),
    processed_count: normalizeSqlParam(input.processed_count),
    total_count: normalizeSqlParam(input.total_count),
    media_candidates_count: normalizeSqlParam(input.media_candidates_count),
    media_updated_rows: normalizeSqlParam(input.media_updated_rows),
    preview_candidates_count: normalizeSqlParam(input.preview_candidates_count),
    preview_updated_rows: normalizeSqlParam(input.preview_updated_rows),
    error_message: normalizeSqlParam(input.error_message),
    details_json: normalizeSqlParam(input.details_json),
    updated_at: nowIso,
  });
}

export function finishImportMediaSyncJob(input: FinishImportMediaSyncJobInput): void {
  const nowIso = new Date().toISOString();
  db.prepare(
    `
      UPDATE import_media_sync_jobs
      SET status = @status,
          stage = COALESCE(@stage, stage),
          processed_count = COALESCE(@processed_count, processed_count),
          total_count = COALESCE(@total_count, total_count),
          media_candidates_count = COALESCE(@media_candidates_count, media_candidates_count),
          media_updated_rows = COALESCE(@media_updated_rows, media_updated_rows),
          preview_candidates_count = COALESCE(@preview_candidates_count, preview_candidates_count),
          preview_updated_rows = COALESCE(@preview_updated_rows, preview_updated_rows),
          error_message = @error_message,
          details_json = @details_json,
          finished_at = @finished_at,
          updated_at = @updated_at
      WHERE id = @id
    `,
  ).run({
    id: input.id,
    status: input.status,
    stage: normalizeSqlParam(input.stage),
    processed_count: normalizeSqlParam(input.processed_count),
    total_count: normalizeSqlParam(input.total_count),
    media_candidates_count: normalizeSqlParam(input.media_candidates_count),
    media_updated_rows: normalizeSqlParam(input.media_updated_rows),
    preview_candidates_count: normalizeSqlParam(input.preview_candidates_count),
    preview_updated_rows: normalizeSqlParam(input.preview_updated_rows),
    error_message: input.error_message ?? null,
    details_json: input.details_json ?? null,
    finished_at: nowIso,
    updated_at: nowIso,
  });
}
