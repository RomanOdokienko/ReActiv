import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { ImportTenantId } from "../import/import-tenants";
import {
  createImportMediaSyncJob,
  finishImportMediaSyncJob,
  getImportMediaSyncJobById,
  getLatestImportMediaSyncJobByImportBatchId,
  getNextQueuedImportMediaSyncJobForTenant,
  markImportMediaSyncJobRunning,
  updateImportMediaSyncJobProgress,
  type ImportMediaSyncJobRecord,
  type ImportMediaSyncJobStage,
  type ImportMediaSyncJobStatus,
} from "../repositories/import-media-sync-job-repository";
import { enrichAlphaMediaForTenant } from "./alpha-media-enrichment-service";
import { syncCardPreviewsForTenant } from "./card-preview-sync-service";
import { enrichResoMediaForTenant } from "./reso-media-enrichment-service";

interface ImportMediaSyncLogger {
  info: (context: Record<string, unknown>, message: string) => void;
  error: (context: Record<string, unknown>, message: string) => void;
}

interface EnqueueImportMediaSyncJobInput {
  importBatchId: string;
  tenantId: ImportTenantId;
  triggerType?: "post_import" | "manual_api";
  logger?: ImportMediaSyncLogger;
}

interface ImportMediaSyncRunContext {
  logger?: ImportMediaSyncLogger;
}

const inMemoryRunningTenants = new Set<string>();
const PROGRESS_UPDATE_STEP = 25;
const PROGRESS_UPDATE_INTERVAL_MS = 1_500;

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
}

function getResoConcurrency(): number {
  return parsePositiveIntEnv("IMPORT_MEDIA_SYNC_RESO_CONCURRENCY", 6);
}

function getAlphaConcurrency(): number {
  return parsePositiveIntEnv("IMPORT_MEDIA_SYNC_ALPHA_CONCURRENCY", 6);
}

function getPreviewConcurrency(): number {
  return parsePositiveIntEnv("IMPORT_MEDIA_SYNC_PREVIEW_CONCURRENCY", 4);
}

function createProgressReporter(
  jobId: string,
  stage: ImportMediaSyncJobStage,
): (processed: number, total: number, force?: boolean) => void {
  let lastProcessed = -1;
  let lastTotal = -1;
  let lastUpdatedAt = 0;

  return (processed: number, total: number, force = false) => {
    const now = Date.now();
    const processedDelta = processed - lastProcessed;
    const totalChanged = total !== lastTotal;
    const timeElapsed = now - lastUpdatedAt;
    const shouldUpdate =
      force ||
      totalChanged ||
      processed === total ||
      processedDelta >= PROGRESS_UPDATE_STEP ||
      timeElapsed >= PROGRESS_UPDATE_INTERVAL_MS;

    if (!shouldUpdate) {
      return;
    }

    updateImportMediaSyncJobProgress({
      id: jobId,
      stage,
      processed_count: Math.max(0, processed),
      total_count: Math.max(0, total),
    });

    lastProcessed = processed;
    lastTotal = total;
    lastUpdatedAt = now;
  };
}

async function runMediaEnrichmentForJob(
  job: ImportMediaSyncJobRecord,
  context: ImportMediaSyncRunContext,
): Promise<{
  mediaCandidatesCount: number;
  mediaUpdatedRows: number;
  warningCount: number;
}> {
  const tenantId = job.tenant_id as ImportTenantId;
  const reportProgress = createProgressReporter(job.id, "media_enrichment");
  reportProgress(0, 0, true);

  if (tenantId === "reso") {
    const result = await enrichResoMediaForTenant({
      tenantId: "reso",
      onlyMissingMedia: true,
      concurrency: getResoConcurrency(),
      logger: context.logger,
      onProgress: (progress) => {
        reportProgress(progress.processed, progress.total);
      },
    });
    reportProgress(result.processedCandidates, result.totalCandidates, true);

    updateImportMediaSyncJobProgress({
      id: job.id,
      media_candidates_count: result.totalCandidates,
      media_updated_rows: result.updatedRows,
    });

    return {
      mediaCandidatesCount: result.totalCandidates,
      mediaUpdatedRows: result.updatedRows,
      warningCount: result.fetchErrorCount,
    };
  }

  if (tenantId === "alpha") {
    const result = await enrichAlphaMediaForTenant({
      tenantId: "alpha",
      onlyMissingMedia: true,
      concurrency: getAlphaConcurrency(),
      logger: context.logger,
      onProgress: (progress) => {
        reportProgress(progress.processed, progress.total);
      },
    });
    reportProgress(result.processedCandidates, result.totalCandidates, true);

    updateImportMediaSyncJobProgress({
      id: job.id,
      media_candidates_count: result.totalCandidates,
      media_updated_rows: result.updatedRows,
    });

    return {
      mediaCandidatesCount: result.totalCandidates,
      mediaUpdatedRows: result.updatedRows,
      warningCount: result.fetchErrorCount,
    };
  }

  updateImportMediaSyncJobProgress({
    id: job.id,
    media_candidates_count: 0,
    media_updated_rows: 0,
    processed_count: 0,
    total_count: 0,
  });
  return {
    mediaCandidatesCount: 0,
    mediaUpdatedRows: 0,
    warningCount: 0,
  };
}

async function runPreviewSyncForJob(
  job: ImportMediaSyncJobRecord,
  context: ImportMediaSyncRunContext,
): Promise<{
  previewCandidatesCount: number;
  previewUpdatedRows: number;
  warningCount: number;
}> {
  const reportProgress = createProgressReporter(job.id, "preview_sync");
  reportProgress(0, 0, true);

  const previewResult = await syncCardPreviewsForTenant({
    tenantId: job.tenant_id,
    force: false,
    concurrency: getPreviewConcurrency(),
    logger: context.logger,
    onProgress: (progress) => {
      reportProgress(progress.processed, progress.total);
    },
  });
  reportProgress(previewResult.processedCandidates, previewResult.totalCandidates, true);

  updateImportMediaSyncJobProgress({
    id: job.id,
    preview_candidates_count: previewResult.totalCandidates,
    preview_updated_rows: previewResult.updatedRows,
  });

  return {
    previewCandidatesCount: previewResult.totalCandidates,
    previewUpdatedRows: previewResult.updatedRows,
    warningCount: previewResult.failedCount,
  };
}

async function runSingleJob(
  job: ImportMediaSyncJobRecord,
  context: ImportMediaSyncRunContext,
): Promise<void> {
  markImportMediaSyncJobRunning(job.id, "media_enrichment");
  const startedAt = Date.now();

  try {
    const enrichment = await runMediaEnrichmentForJob(job, context);

    updateImportMediaSyncJobProgress({
      id: job.id,
      stage: "preview_sync",
      processed_count: 0,
      total_count: 0,
    });

    const preview = await runPreviewSyncForJob(job, context);
    const warningCount = enrichment.warningCount + preview.warningCount;

    const status: ImportMediaSyncJobStatus =
      warningCount > 0 ? "completed_with_errors" : "completed";

    finishImportMediaSyncJob({
      id: job.id,
      status,
      stage: "done",
      processed_count: preview.previewCandidatesCount,
      total_count: preview.previewCandidatesCount,
      media_candidates_count: enrichment.mediaCandidatesCount,
      media_updated_rows: enrichment.mediaUpdatedRows,
      preview_candidates_count: preview.previewCandidatesCount,
      preview_updated_rows: preview.previewUpdatedRows,
      error_message: null,
      details_json: JSON.stringify({
        durationMs: Date.now() - startedAt,
        warningCount,
      }),
    });

    context.logger?.info(
      {
        job_id: job.id,
        import_batch_id: job.import_batch_id,
        tenant_id: job.tenant_id,
        status,
        media_candidates_count: enrichment.mediaCandidatesCount,
        media_updated_rows: enrichment.mediaUpdatedRows,
        preview_candidates_count: preview.previewCandidatesCount,
        preview_updated_rows: preview.previewUpdatedRows,
        warning_count: warningCount,
        duration_ms: Date.now() - startedAt,
      },
      "import_media_sync_job_completed",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    finishImportMediaSyncJob({
      id: job.id,
      status: "failed",
      stage: "done",
      error_message: message,
      details_json: JSON.stringify({
        durationMs: Date.now() - startedAt,
      }),
    });
    context.logger?.error(
      {
        job_id: job.id,
        import_batch_id: job.import_batch_id,
        tenant_id: job.tenant_id,
        error: message,
      },
      "import_media_sync_job_failed",
    );
  }
}

async function runQueuedJobsForTenant(
  tenantId: ImportTenantId,
  context: ImportMediaSyncRunContext,
): Promise<void> {
  if (inMemoryRunningTenants.has(tenantId)) {
    return;
  }

  inMemoryRunningTenants.add(tenantId);
  try {
    while (true) {
      const nextJob = getNextQueuedImportMediaSyncJobForTenant(tenantId);
      if (!nextJob) {
        break;
      }

      await runSingleJob(nextJob, context);
    }
  } finally {
    inMemoryRunningTenants.delete(tenantId);
  }
}

function scheduleTenantQueueRun(
  tenantId: ImportTenantId,
  context: ImportMediaSyncRunContext,
): void {
  setTimeout(() => {
    void runQueuedJobsForTenant(tenantId, context);
  }, 0);
}

export function enqueueImportMediaSyncJob(
  input: EnqueueImportMediaSyncJobInput,
): ImportMediaSyncJobRecord {
  const jobId = randomUUID();
  createImportMediaSyncJob({
    id: jobId,
    import_batch_id: input.importBatchId,
    tenant_id: input.tenantId,
    trigger_type: input.triggerType ?? "post_import",
  });

  const job = getImportMediaSyncJobById(jobId);
  if (!job) {
    throw new Error("Failed to create media sync job");
  }

  scheduleTenantQueueRun(input.tenantId, {
    logger: input.logger,
  });

  return job;
}

export function getLatestImportMediaSyncJobForImportBatch(
  importBatchId: string,
): ImportMediaSyncJobRecord | null {
  return getLatestImportMediaSyncJobByImportBatchId(importBatchId);
}

export function ensureImportMediaSyncBackgroundWorkers(
  logger?: FastifyBaseLogger,
): void {
  const tenantIds: ImportTenantId[] = ["gpb", "reso", "alpha", "sovcombank"];
  tenantIds.forEach((tenantId) => {
    scheduleTenantQueueRun(tenantId, {
      logger,
    });
  });
}
