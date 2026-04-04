import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { ImportTenantId } from "../import/import-tenants";
import { enqueueImportMediaSyncJob } from "./import-media-sync-service";
import { importWorkbook } from "./import-service";
import {
  scrapeCarcadeUsedToWorkbook,
  type CarcadeScrapeOptions,
  type CarcadeScrapeProgress,
} from "../scripts/scrape-carcade-used-to-xlsx";

type CarcadeDirectImportJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed";

type CarcadeDirectImportJobStage =
  | "queued"
  | "scraping"
  | "importing"
  | "media_sync"
  | "done";

export interface CarcadeDirectImportJobRecord {
  id: string;
  tenant_id: ImportTenantId;
  trigger_type: "manual_api";
  status: CarcadeDirectImportJobStatus;
  stage: CarcadeDirectImportJobStage;
  processed_count: number;
  total_count: number;
  error_message: string | null;
  details_json: string | null;
  import_batch_id: string | null;
  media_sync_job_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

interface CarcadeDirectImportLogger {
  info: (context: Record<string, unknown>, message: string) => void;
  error: (context: Record<string, unknown>, message: string) => void;
}

interface EnqueueCarcadeDirectImportJobInput {
  logger?: CarcadeDirectImportLogger;
}

const JOB_HISTORY_LIMIT = 50;
const DIRECT_IMPORT_TENANT_ID: ImportTenantId = "carcade";
const jobsById = new Map<string, CarcadeDirectImportJobRecord>();
const jobQueue: string[] = [];
let isWorkerRunning = false;

function nowIso(): string {
  return new Date().toISOString();
}

function parsePositiveIntEnv(
  name: string,
  fallback: number,
  max: number,
): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.floor(parsed), max));
}

function parseNonNegativeIntEnv(
  name: string,
  fallback: number,
  max: number,
): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.max(0, Math.min(Math.floor(parsed), max));
}

function getSafeScrapeOptions(): CarcadeScrapeOptions {
  return {
    // Conservative defaults to avoid tripping anti-bot limits.
    pageLimit: parsePositiveIntEnv("CARCADE_DIRECT_IMPORT_PAGE_LIMIT", 500, 700),
    delayMs: parseNonNegativeIntEnv("CARCADE_DIRECT_IMPORT_DELAY_MS", 300, 10_000),
    timeoutMs: parsePositiveIntEnv("CARCADE_DIRECT_IMPORT_TIMEOUT_MS", 20_000, 120_000),
  };
}

function createJob(): CarcadeDirectImportJobRecord {
  const now = nowIso();
  return {
    id: randomUUID(),
    tenant_id: DIRECT_IMPORT_TENANT_ID,
    trigger_type: "manual_api",
    status: "queued",
    stage: "queued",
    processed_count: 0,
    total_count: 0,
    error_message: null,
    details_json: null,
    import_batch_id: null,
    media_sync_job_id: null,
    created_at: now,
    started_at: null,
    finished_at: null,
    updated_at: now,
  };
}

function touchJob(job: CarcadeDirectImportJobRecord): void {
  job.updated_at = nowIso();
}

function getLatestJob(): CarcadeDirectImportJobRecord | null {
  if (jobQueue.length === 0) {
    return null;
  }

  const lastJobId = jobQueue[jobQueue.length - 1];
  if (!lastJobId) {
    return null;
  }

  return jobsById.get(lastJobId) ?? null;
}

function trimFinishedJobs(): void {
  if (jobQueue.length <= JOB_HISTORY_LIMIT) {
    return;
  }

  const removable = jobQueue.length - JOB_HISTORY_LIMIT;
  for (let index = 0; index < removable; index += 1) {
    const jobId = jobQueue[index];
    if (!jobId) {
      continue;
    }
    jobsById.delete(jobId);
  }

  jobQueue.splice(0, removable);
}

function isActiveJob(job: CarcadeDirectImportJobRecord | null): boolean {
  return Boolean(job && (job.status === "queued" || job.status === "running"));
}

function applyProgress(job: CarcadeDirectImportJobRecord, progress: CarcadeScrapeProgress): void {
  if (job.status !== "running") {
    return;
  }

  job.stage = "scraping";
  job.processed_count = Math.max(0, progress.processed);
  job.total_count = Math.max(0, progress.total);
  touchJob(job);
}

function toDirectImportFilename(): string {
  const datePart = new Date().toISOString().slice(0, 10);
  return `carcade-direct-import-${datePart}.xlsx`;
}

async function runSingleJob(
  job: CarcadeDirectImportJobRecord,
  logger?: CarcadeDirectImportLogger,
): Promise<void> {
  job.status = "running";
  job.stage = "scraping";
  job.started_at = nowIso();
  job.error_message = null;
  job.finished_at = null;
  touchJob(job);

  try {
    const scrapeOptions = getSafeScrapeOptions();
    logger?.info(
      {
        job_id: job.id,
        tenant_id: job.tenant_id,
        scrape_options: scrapeOptions,
      },
      "carcade_direct_import_scrape_started",
    );

    const scrapeResult = await scrapeCarcadeUsedToWorkbook(scrapeOptions, (progress) => {
      applyProgress(job, progress);
    });

    job.stage = "importing";
    job.processed_count = 0;
    job.total_count = 0;
    touchJob(job);

    const importResult = importWorkbook({
      filename: toDirectImportFilename(),
      fileBuffer: scrapeResult.fileBuffer,
      tenantId: DIRECT_IMPORT_TENANT_ID,
      logger,
    });

    job.import_batch_id = importResult.importBatchId;

    job.stage = "media_sync";
    touchJob(job);

    let mediaSyncJobId: string | null = null;
    let mediaSyncError: string | null = null;
    if (importResult.summary.importedRows > 0) {
      try {
        const mediaSyncJob = enqueueImportMediaSyncJob({
          importBatchId: importResult.importBatchId,
          tenantId: DIRECT_IMPORT_TENANT_ID,
          triggerType: "post_import",
          logger,
        });
        mediaSyncJobId = mediaSyncJob.id;
      } catch (error) {
        mediaSyncError = error instanceof Error ? error.message : "unknown_media_sync_error";
      }
    }

    job.media_sync_job_id = mediaSyncJobId;
    job.stage = "done";
    job.processed_count = importResult.summary.importedRows;
    job.total_count = importResult.summary.totalRows;
    job.details_json = JSON.stringify({
      scrape: {
        itemsCount: scrapeResult.itemsCount,
        withPrice: scrapeResult.withPrice,
        withYear: scrapeResult.withYear,
        withMileage: scrapeResult.withMileage,
        withMedia: scrapeResult.withMedia,
      },
      import: importResult.summary,
      importStatus: importResult.status,
      mediaSyncJobId,
      mediaSyncError,
    });

    const hasWarnings =
      importResult.status === "completed_with_errors" || Boolean(mediaSyncError);
    job.status = hasWarnings ? "completed_with_errors" : "completed";
    job.finished_at = nowIso();
    touchJob(job);

    logger?.info(
      {
        job_id: job.id,
        tenant_id: job.tenant_id,
        import_batch_id: importResult.importBatchId,
        media_sync_job_id: mediaSyncJobId,
        status: job.status,
        imported_rows: importResult.summary.importedRows,
        total_rows: importResult.summary.totalRows,
      },
      "carcade_direct_import_job_completed",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    job.stage = "done";
    job.status = "failed";
    job.error_message = message;
    job.finished_at = nowIso();
    touchJob(job);

    logger?.error(
      {
        job_id: job.id,
        tenant_id: job.tenant_id,
        error: message,
      },
      "carcade_direct_import_job_failed",
    );
  }
}

async function processQueue(logger?: CarcadeDirectImportLogger): Promise<void> {
  if (isWorkerRunning) {
    return;
  }

  isWorkerRunning = true;
  try {
    while (true) {
      const nextJob = jobQueue
        .map((jobId) => jobsById.get(jobId) ?? null)
        .find((job) => Boolean(job && job.status === "queued"));

      if (!nextJob) {
        break;
      }

      await runSingleJob(nextJob, logger);
    }
  } finally {
    isWorkerRunning = false;
  }
}

function scheduleQueueProcessing(logger?: CarcadeDirectImportLogger): void {
  setTimeout(() => {
    void processQueue(logger);
  }, 0);
}

export function enqueueCarcadeDirectImportJob(
  input: EnqueueCarcadeDirectImportJobInput = {},
): CarcadeDirectImportJobRecord {
  const latest = getLatestJob();
  if (isActiveJob(latest)) {
    return latest as CarcadeDirectImportJobRecord;
  }

  const job = createJob();
  jobsById.set(job.id, job);
  jobQueue.push(job.id);
  trimFinishedJobs();
  scheduleQueueProcessing(input.logger);
  return job;
}

export function getCarcadeDirectImportJobById(
  jobId: string,
): CarcadeDirectImportJobRecord | null {
  return jobsById.get(jobId) ?? null;
}

export function getLatestCarcadeDirectImportJob(): CarcadeDirectImportJobRecord | null {
  return getLatestJob();
}

export function ensureCarcadeDirectImportBackgroundWorker(
  logger?: FastifyBaseLogger,
): void {
  scheduleQueueProcessing(logger);
}
