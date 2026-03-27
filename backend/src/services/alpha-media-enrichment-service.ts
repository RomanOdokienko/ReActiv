import {
  listVehicleOfferMediaCandidatesWithWebsiteByTenant,
  updateVehicleOfferMediaUrlsByOfferCode,
} from "../repositories/vehicle-offer-repository";

const DEFAULT_CONCURRENCY = 6;
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;
const MAX_MEDIA_URLS_PER_ITEM = 200;
const ALPHA_IMAGE_REGEX =
  /https:\/\/storage\.yandexcloud\.net\/car-search-public\/[a-z0-9]+(?:\.(?:jpe?g|png|webp))(?:\?[^"'<> \n\r\t]+)?/gi;

interface ServiceLogger {
  info: (context: Record<string, unknown>, message: string) => void;
  error: (context: Record<string, unknown>, message: string) => void;
}

export interface AlphaMediaEnrichmentProgress {
  processed: number;
  total: number;
}

export interface AlphaMediaEnrichmentInput {
  tenantId: "alpha";
  logger?: ServiceLogger;
  limit?: number;
  concurrency?: number;
  onlyMissingMedia?: boolean;
  onProgress?: (progress: AlphaMediaEnrichmentProgress) => void;
}

export interface AlphaMediaEnrichmentResult {
  tenantId: "alpha";
  totalRows: number;
  totalCandidates: number;
  processedCandidates: number;
  skippedUnsupportedSourceCount: number;
  skippedWithExistingMediaCount: number;
  noMediaCount: number;
  fetchErrorCount: number;
  preparedUpdatesCount: number;
  updatedRows: number;
  durationMs: number;
}

function isValidHttpUrl(value: string | null): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isSupportedAlphaSourceUrl(value: string | null): boolean {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  try {
    const parsed = new URL(value as string);
    const host = parsed.hostname.toLowerCase();
    return host === "alfaleasing.ru" || host === "www.alfaleasing.ru";
  } catch {
    return false;
  }
}

function extractAlphaPhotoUrlsFromHtml(html: string): string[] {
  const matches = html.match(ALPHA_IMAGE_REGEX) ?? [];
  return [...new Set(matches)]
    .map((value) => value.trim())
    .filter((value) => isValidHttpUrl(value))
    .slice(0, MAX_MEDIA_URLS_PER_ITEM);
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: abortController.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function runConcurrently<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let nextIndex = 0;
  const workers = Array.from({
    length: Math.max(1, Math.min(concurrency, items.length)),
  }).map(async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex]);
    }
  });

  await Promise.all(workers);
}

export async function enrichAlphaMediaForTenant(
  input: AlphaMediaEnrichmentInput,
): Promise<AlphaMediaEnrichmentResult> {
  const startedAt = Date.now();
  const onlyMissingMedia = input.onlyMissingMedia ?? true;
  const concurrency = input.concurrency ?? DEFAULT_CONCURRENCY;
  const timeoutMs = DEFAULT_FETCH_TIMEOUT_MS;
  const rows = listVehicleOfferMediaCandidatesWithWebsiteByTenant(input.tenantId);
  const limitedRows =
    typeof input.limit === "number" && input.limit > 0
      ? rows.slice(0, Math.floor(input.limit))
      : rows;

  const supportedRows = limitedRows.filter((row) => isSupportedAlphaSourceUrl(row.websiteUrl));
  const skippedUnsupportedSourceCount = limitedRows.length - supportedRows.length;
  const candidates = onlyMissingMedia
    ? supportedRows.filter((row) => !row.yandexDiskUrl?.trim())
    : supportedRows;
  const skippedWithExistingMediaCount = supportedRows.length - candidates.length;

  let processedCandidates = 0;
  let noMediaCount = 0;
  let fetchErrorCount = 0;
  const updates: Array<{ offerCode: string; yandexDiskUrl: string }> = [];

  await runConcurrently(candidates, concurrency, async (candidate) => {
    try {
      const html = await fetchHtml(candidate.websiteUrl as string, timeoutMs);
      const mediaUrls = extractAlphaPhotoUrlsFromHtml(html);
      if (mediaUrls.length === 0) {
        noMediaCount += 1;
        return;
      }

      updates.push({
        offerCode: candidate.offerCode.trim(),
        yandexDiskUrl: mediaUrls.join("\n"),
      });
    } catch (error) {
      fetchErrorCount += 1;
      input.logger?.error(
        {
          tenant_id: input.tenantId,
          offer_code: candidate.offerCode,
          website_url: candidate.websiteUrl,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "alpha_media_enrichment_fetch_failed",
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
      accumulator.set(item.offerCode, item.yandexDiskUrl);
      return accumulator;
    }, new Map<string, string>()),
  ).map(([offerCode, yandexDiskUrl]) => ({ offerCode, yandexDiskUrl }));

  const updatedRows = updateVehicleOfferMediaUrlsByOfferCode(
    input.tenantId,
    deduplicatedUpdates,
  );

  input.logger?.info(
    {
      tenant_id: input.tenantId,
      total_rows: limitedRows.length,
      total_candidates: candidates.length,
      processed_candidates: processedCandidates,
      skipped_unsupported_source_count: skippedUnsupportedSourceCount,
      skipped_with_existing_media_count: skippedWithExistingMediaCount,
      no_media_count: noMediaCount,
      fetch_error_count: fetchErrorCount,
      prepared_updates_count: deduplicatedUpdates.length,
      updated_rows: updatedRows,
      duration_ms: Date.now() - startedAt,
    },
    "alpha_media_enrichment_completed",
  );

  return {
    tenantId: input.tenantId,
    totalRows: limitedRows.length,
    totalCandidates: candidates.length,
    processedCandidates,
    skippedUnsupportedSourceCount,
    skippedWithExistingMediaCount,
    noMediaCount,
    fetchErrorCount,
    preparedUpdatesCount: deduplicatedUpdates.length,
    updatedRows,
    durationMs: Date.now() - startedAt,
  };
}
