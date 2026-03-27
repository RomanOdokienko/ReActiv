import fs from "node:fs/promises";
import sharp from "sharp";
import {
  listVehicleOfferMediaCandidatesByTenant,
  updateVehicleOfferCardPreviewPathsByOfferCode,
  type VehicleOfferMediaCandidate,
} from "../repositories/vehicle-offer-repository";
import {
  buildCardPreviewRelativePath,
  ensureStoredMediaParentDirectory,
  storedMediaFileExists,
} from "./local-media-storage";
import { fetchAllowedMediaRemote, resolvePreviewUrl } from "./media-preview-service";

const DEFAULT_CONCURRENCY = 4;
const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 480;
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_MAX_REDIRECTS = 3;

interface ServiceLogger {
  info: (context: Record<string, unknown>, message: string) => void;
  error: (context: Record<string, unknown>, message: string) => void;
}

export interface CardPreviewSyncProgress {
  processed: number;
  total: number;
}

export interface CardPreviewSyncInput {
  tenantId: string;
  limit?: number;
  concurrency?: number;
  force?: boolean;
  logger?: ServiceLogger;
  onProgress?: (progress: CardPreviewSyncProgress) => void;
}

export interface CardPreviewSyncResult {
  tenantId: string;
  totalRows: number;
  totalCandidates: number;
  processedCandidates: number;
  skippedExistingCount: number;
  skippedNoSourceCount: number;
  skippedNoPreviewCount: number;
  failedCount: number;
  preparedUpdatesCount: number;
  updatedRows: number;
  durationMs: number;
}

interface PreviewSyncCandidate extends VehicleOfferMediaCandidate {
  previewSourceUrl: string;
}

function createThumbnailBuffer(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .rotate()
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: "cover",
      position: "entropy",
      withoutEnlargement: false,
    })
    .jpeg({
      quality: 72,
      mozjpeg: true,
      progressive: true,
    })
    .toBuffer();
}

function runConcurrently<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return Promise.resolve();
  }

  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const workers = Array.from({ length: workerCount }).map(async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex]);
    }
  });

  return Promise.all(workers).then(() => undefined);
}

function buildCandidates(
  rows: VehicleOfferMediaCandidate[],
  force: boolean,
): {
  candidates: PreviewSyncCandidate[];
  skippedExistingCount: number;
  skippedNoSourceCount: number;
} {
  const candidates: PreviewSyncCandidate[] = [];
  let skippedExistingCount = 0;
  let skippedNoSourceCount = 0;

  rows.forEach((row) => {
    if (!force && row.cardPreviewPath && storedMediaFileExists(row.cardPreviewPath)) {
      skippedExistingCount += 1;
      return;
    }

    const previewSourceUrl = row.yandexDiskUrl?.trim() ?? "";
    if (!previewSourceUrl) {
      skippedNoSourceCount += 1;
      return;
    }

    candidates.push({
      ...row,
      previewSourceUrl,
    });
  });

  return {
    candidates,
    skippedExistingCount,
    skippedNoSourceCount,
  };
}

export async function syncCardPreviewsForTenant(
  input: CardPreviewSyncInput,
): Promise<CardPreviewSyncResult> {
  const startedAt = Date.now();
  const concurrency = Math.max(1, Math.floor(input.concurrency ?? DEFAULT_CONCURRENCY));
  const force = input.force ?? false;
  const rows = listVehicleOfferMediaCandidatesByTenant(input.tenantId);
  const limitedRows =
    typeof input.limit === "number" && input.limit > 0
      ? rows.slice(0, Math.floor(input.limit))
      : rows;

  const { candidates, skippedExistingCount, skippedNoSourceCount } = buildCandidates(
    limitedRows,
    force,
  );

  let processedCandidates = 0;
  let skippedNoPreviewCount = 0;
  let failedCount = 0;
  const updates: Array<{ offerCode: string; cardPreviewPath: string }> = [];

  await runConcurrently(candidates, concurrency, async (candidate) => {
    try {
      const resolved = await resolvePreviewUrl(candidate.previewSourceUrl);
      if (!resolved.previewUrl) {
        skippedNoPreviewCount += 1;
        return;
      }

      const response = await fetchAllowedMediaRemote(resolved.previewUrl, {
        method: "GET",
        timeoutMs: FETCH_TIMEOUT_MS,
        maxRedirects: FETCH_MAX_REDIRECTS,
      });
      if (!response.ok) {
        throw new Error(`Preview fetch failed with status ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const originalBuffer = Buffer.from(arrayBuffer);
      const thumbnailBuffer = await createThumbnailBuffer(originalBuffer);
      const relativePath = buildCardPreviewRelativePath(
        candidate.tenantId,
        candidate.offerCode,
      );
      const absolutePath = ensureStoredMediaParentDirectory(relativePath);
      await fs.writeFile(absolutePath, thumbnailBuffer);

      updates.push({
        offerCode: candidate.offerCode,
        cardPreviewPath: relativePath,
      });
    } catch (error) {
      failedCount += 1;
      input.logger?.error(
        {
          tenant_id: candidate.tenantId,
          offer_code: candidate.offerCode,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "card_preview_sync_candidate_failed",
      );
    } finally {
      processedCandidates += 1;
      input.onProgress?.({
        processed: processedCandidates,
        total: candidates.length,
      });
    }
  });

  const deduplicatedUpdates = Array.from(
    updates.reduce<Map<string, string>>((accumulator, item) => {
      accumulator.set(item.offerCode, item.cardPreviewPath);
      return accumulator;
    }, new Map<string, string>()),
  ).map(([offerCode, cardPreviewPath]) => ({
    offerCode,
    cardPreviewPath,
  }));

  const updatedRows = updateVehicleOfferCardPreviewPathsByOfferCode(
    input.tenantId,
    deduplicatedUpdates,
  );

  return {
    tenantId: input.tenantId,
    totalRows: limitedRows.length,
    totalCandidates: candidates.length,
    processedCandidates,
    skippedExistingCount,
    skippedNoSourceCount,
    skippedNoPreviewCount,
    failedCount,
    preparedUpdatesCount: deduplicatedUpdates.length,
    updatedRows,
    durationMs: Date.now() - startedAt,
  };
}
