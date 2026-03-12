import {
  listVehicleOfferMediaCandidatesByTenant,
  updateVehicleOfferMediaUrlsByOfferCode,
} from "../repositories/vehicle-offer-repository";

const RESO_SALE_API_BASE_URL = "https://admin.resoleasing.com/api/sales-catalog";
const RESO_IMAGE_BASE_URL = "https://api-sale.resoleasing.com";
const VIN_REGEX = /^[A-Z0-9]{17}$/i;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

interface ResoSaleCatalogResponse {
  photos?: {
    ORIGINAL?: Array<string | null>;
    BIG?: Array<string | null>;
  };
}

interface ServiceLogger {
  info: (context: Record<string, unknown>, message: string) => void;
  error: (context: Record<string, unknown>, message: string) => void;
}

export interface ResoMediaEnrichmentInput {
  tenantId: "reso";
  logger?: ServiceLogger;
  limit?: number;
  concurrency?: number;
  onlyMissingMedia?: boolean;
}

export interface ResoMediaEnrichmentResult {
  tenantId: "reso";
  totalCandidates: number;
  processedCandidates: number;
  validVinCount: number;
  skippedWithExistingMediaCount: number;
  noMediaCount: number;
  fetchErrorCount: number;
  updatedRows: number;
  durationMs: number;
}

const runningTenants = new Set<string>();

function normalizePhotoUrl(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${RESO_IMAGE_BASE_URL}${trimmed}`;
  }

  return `${RESO_IMAGE_BASE_URL}/${trimmed}`;
}

async function fetchResoPhotoUrlsByVin(
  vin: string,
  timeoutMs: number,
): Promise<string[]> {
  const requestUrl = new URL(RESO_SALE_API_BASE_URL);
  requestUrl.searchParams.set("vin", vin);

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      signal: abortController.signal,
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as ResoSaleCatalogResponse;
    const urls = [
      ...(payload.photos?.ORIGINAL ?? []),
      ...(payload.photos?.BIG ?? []),
    ]
      .map((value) => normalizePhotoUrl(value))
      .filter((value): value is string => Boolean(value));

    return [...new Set(urls)];
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

export async function enrichResoMediaForTenant(
  input: ResoMediaEnrichmentInput,
): Promise<ResoMediaEnrichmentResult> {
  const startedAt = Date.now();
  const onlyMissingMedia = input.onlyMissingMedia ?? true;
  const concurrency = input.concurrency ?? DEFAULT_CONCURRENCY;
  const timeoutMs = DEFAULT_FETCH_TIMEOUT_MS;
  const candidatesRaw = listVehicleOfferMediaCandidatesByTenant(input.tenantId);
  const candidates =
    typeof input.limit === "number" && input.limit > 0
      ? candidatesRaw.slice(0, Math.floor(input.limit))
      : candidatesRaw;

  let processedCandidates = 0;
  let validVinCount = 0;
  let skippedWithExistingMediaCount = 0;
  let noMediaCount = 0;
  let fetchErrorCount = 0;
  const updates: Array<{ offerCode: string; yandexDiskUrl: string }> = [];
  const mediaByVinCache = new Map<string, string[]>();

  await runConcurrently(candidates, concurrency, async (candidate) => {
    processedCandidates += 1;

    const offerCode = candidate.offerCode.trim();
    if (!VIN_REGEX.test(offerCode)) {
      return;
    }

    validVinCount += 1;

    if (onlyMissingMedia && candidate.yandexDiskUrl?.trim()) {
      skippedWithExistingMediaCount += 1;
      return;
    }

    try {
      const vin = offerCode.toUpperCase();
      const mediaUrls =
        mediaByVinCache.get(vin) ??
        (await fetchResoPhotoUrlsByVin(vin, timeoutMs));
      if (!mediaByVinCache.has(vin)) {
        mediaByVinCache.set(vin, mediaUrls);
      }

      if (mediaUrls.length === 0) {
        noMediaCount += 1;
        return;
      }

      updates.push({
        offerCode,
        yandexDiskUrl: mediaUrls.join("\n"),
      });
    } catch (error) {
      fetchErrorCount += 1;
      input.logger?.error(
        {
          tenant_id: input.tenantId,
          offer_code: offerCode,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "reso_media_enrichment_fetch_failed",
      );
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

  return {
    tenantId: input.tenantId,
    totalCandidates: candidates.length,
    processedCandidates,
    validVinCount,
    skippedWithExistingMediaCount,
    noMediaCount,
    fetchErrorCount,
    updatedRows,
    durationMs: Date.now() - startedAt,
  };
}

export function runResoMediaEnrichmentInBackground(
  input: ResoMediaEnrichmentInput,
): void {
  if (runningTenants.has(input.tenantId)) {
    input.logger?.info(
      { tenant_id: input.tenantId },
      "reso_media_enrichment_skipped_already_running",
    );
    return;
  }

  runningTenants.add(input.tenantId);

  void enrichResoMediaForTenant(input)
    .then((result) => {
      input.logger?.info(
        {
          tenant_id: result.tenantId,
          total_candidates: result.totalCandidates,
          processed_candidates: result.processedCandidates,
          valid_vin_count: result.validVinCount,
          skipped_with_existing_media_count: result.skippedWithExistingMediaCount,
          no_media_count: result.noMediaCount,
          fetch_error_count: result.fetchErrorCount,
          updated_rows: result.updatedRows,
          duration_ms: result.durationMs,
        },
        "reso_media_enrichment_completed",
      );
    })
    .catch((error) => {
      input.logger?.error(
        {
          tenant_id: input.tenantId,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "reso_media_enrichment_failed",
      );
    })
    .finally(() => {
      runningTenants.delete(input.tenantId);
    });
}
