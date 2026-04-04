import { db } from "../db/connection";
import { parseImportTenantId, type ImportTenantId } from "../import/import-tenants";
import { getLatestSuccessfulImportBatch } from "../repositories/import-batch-repository";

const VTB_BASE_URL = "https://www.vtb-leasing.ru";
const VTB_MARKET_ROOT_PATH = "/market/";
const DEFAULT_PAGE_LIMIT = 300;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_DELAY_MS = 250;
const DEFAULT_CATEGORY_CODES = ["1", "2", "3", "4", "5", "6"];

const VEHICLE_TYPE_BY_CATEGORY_CODE: Record<string, string> = {
  "1": "\u0410\u0412\u0422\u041e\u0411\u0423\u0421",
  "2": "\u0413\u0420\u0423\u0417\u041e\u0412\u041e\u0419",
  "3": "\u041b\u041a\u0422",
  "4": "\u041b\u0415\u0413\u041a\u041e\u0412\u041e\u0419",
  "5": "\u041f\u0420\u0418\u0426\u0415\u041f",
  "6": "\u0421\u041f\u0415\u0426\u0422\u0415\u0425\u041d\u0418\u041a\u0410",
};

interface CliOptions {
  tenantId: ImportTenantId;
  importBatchId?: string;
  dryRun: boolean;
  pageLimit: number;
  timeoutMs: number;
  delayMs: number;
}

interface UrlMappingResult {
  urlToVehicleType: Map<string, string>;
  categories: string[];
  processedPages: number;
  ambiguousUrls: string[];
}

interface OfferRow {
  offer_code: string;
  website_url: string;
  vehicle_type: string;
}

interface PreparedUpdate {
  offerCode: string;
  vehicleType: string;
}

interface UpdatePlan {
  totalOffersInBatch: number;
  withWebsiteUrl: number;
  matchedByUrl: number;
  preparedUpdates: PreparedUpdate[];
  unchangedByType: number;
  notMatchedByUrl: number;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
}

function pickArgValue(argsMap: Map<string, string>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const value = argsMap.get(alias);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function pickArgOrEnvValue(
  argsMap: Map<string, string>,
  aliases: string[],
  envNames: string[],
): string | undefined {
  const fromArgs = pickArgValue(argsMap, aliases);
  if (fromArgs !== undefined) {
    return fromArgs;
  }

  for (const envName of envNames) {
    const value = process.env[envName];
    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const argsMap = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex < 0) {
      argsMap.set(arg.slice(2), "true");
      continue;
    }
    argsMap.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
  }

  const tenantRaw =
    pickArgOrEnvValue(argsMap, ["tenant"], ["TENANT_ID", "npm_config_tenant"]) ??
    "vtb";
  const tenantId = parseImportTenantId(tenantRaw);
  if (!tenantId) {
    throw new Error(`Invalid --tenant value: ${tenantRaw}`);
  }
  if (tenantId !== "vtb") {
    throw new Error(`This script currently supports only tenant=vtb, got ${tenantId}`);
  }

  const importBatchId =
    pickArgOrEnvValue(
      argsMap,
      ["batchId", "batchid", "batch_id"],
      ["BATCH_ID", "IMPORT_BATCH_ID", "npm_config_batchid", "npm_config_batch_id"],
    )?.trim() || undefined;

  return {
    tenantId,
    importBatchId,
    dryRun: parseBoolean(
      pickArgOrEnvValue(
        argsMap,
        ["dryRun", "dryrun", "dry_run"],
        ["DRY_RUN", "npm_config_dryrun", "npm_config_dry_run"],
      ),
      true,
    ),
    pageLimit: parsePositiveInt(
      pickArgOrEnvValue(
        argsMap,
        ["pageLimit", "pagelimit", "page_limit"],
        ["PAGE_LIMIT", "npm_config_pagelimit", "npm_config_page_limit"],
      ),
      DEFAULT_PAGE_LIMIT,
    ),
    timeoutMs: parsePositiveInt(
      pickArgOrEnvValue(
        argsMap,
        ["timeoutMs", "timeoutms", "timeout_ms"],
        ["TIMEOUT_MS", "npm_config_timeoutms", "npm_config_timeout_ms"],
      ),
      DEFAULT_TIMEOUT_MS,
    ),
    delayMs: parseNonNegativeInt(
      pickArgOrEnvValue(
        argsMap,
        ["delayMs", "delayms", "delay_ms"],
        ["DELAY_MS", "npm_config_delayms", "npm_config_delay_ms"],
      ),
      DEFAULT_DELAY_MS,
    ),
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: abortController.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeMarketPath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return VTB_MARKET_ROOT_PATH;
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function buildMarketPageUrl(pathname: string, page: number): string {
  const marketPath = normalizeMarketPath(pathname);
  if (page <= 1) {
    return `${VTB_BASE_URL}${marketPath}`;
  }
  return `${VTB_BASE_URL}${marketPath}?PAGEN_1=${page}`;
}

function extractLastPageNumber(html: string): number {
  const matches = [...html.matchAll(/(?:\?|&|&amp;)PAGEN_1=(\d+)/gi)];
  if (matches.length === 0) {
    return 1;
  }

  const numbers = matches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));

  if (numbers.length === 0) {
    return 1;
  }

  return Math.max(...numbers);
}

function isOfferPath(pathname: string): boolean {
  if (!pathname) {
    return false;
  }
  if (/^\/market\/f\//i.test(pathname)) {
    return false;
  }
  if (pathname === "/market" || pathname === "/market/") {
    return false;
  }
  return /^\/market\//i.test(pathname) || /^\/auto\/probeg\//i.test(pathname);
}

function normalizePathWithTrailingSlash(pathname: string): string {
  if (!pathname) {
    return "";
  }
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function extractHrefValues(html: string): string[] {
  return [...html.matchAll(/href=['"]([^'"]+)['"]/gi)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
}

function extractAnchorHrefsByClass(html: string, classFragment: string): string[] {
  const links: string[] = [];
  const anchorTags = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0] ?? "");

  anchorTags.forEach((tag) => {
    const classAttr = tag.match(/\bclass=['"]([^'"]+)['"]/i)?.[1] ?? "";
    if (!classAttr.includes(classFragment)) {
      return;
    }

    const href = tag.match(/\bhref=['"]([^'"]+)['"]/i)?.[1] ?? "";
    if (!href.trim()) {
      return;
    }

    links.push(href.trim());
  });

  return links;
}

function toNormalizedOfferUrl(href: string): string {
  try {
    const parsed = new URL(href, VTB_BASE_URL);
    if (parsed.hostname !== new URL(VTB_BASE_URL).hostname) {
      return "";
    }

    const pathname = normalizePathWithTrailingSlash(parsed.pathname);
    if (!isOfferPath(pathname)) {
      return "";
    }

    return `${VTB_BASE_URL}${pathname}`;
  } catch {
    return "";
  }
}

function extractOfferUrlsFromListingPage(html: string): string[] {
  const primary = extractAnchorHrefsByClass(html, "t-market-item-bottom-link")
    .map((href) => toNormalizedOfferUrl(href))
    .filter(Boolean);

  if (primary.length > 0) {
    return [...new Set(primary)];
  }

  const fallback = extractHrefValues(html)
    .map((href) => toNormalizedOfferUrl(href))
    .filter(Boolean);

  return [...new Set(fallback)];
}

function extractCategoryCodes(rootHtml: string): string[] {
  const matches = [...rootHtml.matchAll(/type-is-(\d+)/gi)];
  const detected = [...new Set(matches.map((match) => match[1]))]
    .filter((code) => code in VEHICLE_TYPE_BY_CATEGORY_CODE)
    .sort((left, right) => Number(left) - Number(right));

  const combined = [...new Set([...DEFAULT_CATEGORY_CODES, ...detected])]
    .filter((code) => code in VEHICLE_TYPE_BY_CATEGORY_CODE)
    .sort((left, right) => Number(left) - Number(right));

  return combined;
}

async function buildUrlToVehicleTypeMap(options: CliOptions): Promise<UrlMappingResult> {
  const rootHtml = await fetchTextWithTimeout(
    `${VTB_BASE_URL}${VTB_MARKET_ROOT_PATH}`,
    options.timeoutMs,
  );
  const categoryCodes = extractCategoryCodes(rootHtml);
  const urlToVehicleType = new Map<string, string>();
  const ambiguousUrlTypeSet = new Map<string, Set<string>>();
  let processedPages = 0;

  for (const categoryCode of categoryCodes) {
    const vehicleType = VEHICLE_TYPE_BY_CATEGORY_CODE[categoryCode];
    if (!vehicleType) {
      continue;
    }

    const categoryPath = `/market/f/type-is-${categoryCode}/`;
    const firstPageUrl = buildMarketPageUrl(categoryPath, 1);
    const firstPageHtml = await fetchTextWithTimeout(firstPageUrl, options.timeoutMs);
    const lastPage = extractLastPageNumber(firstPageHtml);
    const targetPageCount = Math.max(1, Math.min(lastPage, options.pageLimit));

    for (let page = 1; page <= targetPageCount; page += 1) {
      const pageHtml =
        page === 1
          ? firstPageHtml
          : await fetchTextWithTimeout(buildMarketPageUrl(categoryPath, page), options.timeoutMs);

      const offerUrls = extractOfferUrlsFromListingPage(pageHtml);
      offerUrls.forEach((offerUrl) => {
        const existingType = urlToVehicleType.get(offerUrl);
        if (!existingType) {
          urlToVehicleType.set(offerUrl, vehicleType);
          return;
        }

        if (existingType !== vehicleType) {
          const conflictSet = ambiguousUrlTypeSet.get(offerUrl) ?? new Set<string>([existingType]);
          conflictSet.add(vehicleType);
          ambiguousUrlTypeSet.set(offerUrl, conflictSet);
        }
      });

      processedPages += 1;
      // eslint-disable-next-line no-console
      console.log("vtb_vehicle_type_backfill_list_page_done", {
        categoryCode,
        vehicleType,
        page,
        targetPageCount,
        linksFound: offerUrls.length,
        uniqueUrlsCollected: urlToVehicleType.size,
      });

      if (page < targetPageCount && options.delayMs > 0) {
        await sleep(options.delayMs);
      }
    }

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  return {
    urlToVehicleType,
    categories: categoryCodes,
    processedPages,
    ambiguousUrls: Array.from(ambiguousUrlTypeSet.keys()),
  };
}

function resolveTargetBatchId(tenantId: ImportTenantId, explicitBatchId?: string): string {
  if (explicitBatchId) {
    return explicitBatchId;
  }

  const latestBatch = getLatestSuccessfulImportBatch(tenantId);
  if (!latestBatch) {
    throw new Error(`No successful import batch found for tenant=${tenantId}`);
  }

  return latestBatch.id;
}

function normalizeStoredOfferUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }

  return toNormalizedOfferUrl(trimmed);
}

function buildUpdatePlan(
  tenantId: ImportTenantId,
  importBatchId: string,
  urlToVehicleType: Map<string, string>,
): UpdatePlan {
  const rows = db
    .prepare(
      `
        SELECT offer_code, website_url, vehicle_type
        FROM vehicle_offers
        WHERE tenant_id = ?
          AND import_batch_id = ?
      `,
    )
    .all(tenantId, importBatchId) as OfferRow[];

  const updates: PreparedUpdate[] = [];
  let withWebsiteUrl = 0;
  let matchedByUrl = 0;
  let unchangedByType = 0;
  let notMatchedByUrl = 0;

  rows.forEach((row) => {
    const normalizedUrl = normalizeStoredOfferUrl(row.website_url);
    if (!normalizedUrl) {
      return;
    }

    withWebsiteUrl += 1;
    const mappedVehicleType = urlToVehicleType.get(normalizedUrl);
    if (!mappedVehicleType) {
      notMatchedByUrl += 1;
      return;
    }

    matchedByUrl += 1;
    if (row.vehicle_type === mappedVehicleType) {
      unchangedByType += 1;
      return;
    }

    updates.push({
      offerCode: row.offer_code,
      vehicleType: mappedVehicleType,
    });
  });

  return {
    totalOffersInBatch: rows.length,
    withWebsiteUrl,
    matchedByUrl,
    preparedUpdates: updates,
    unchangedByType,
    notMatchedByUrl,
  };
}

function applyUpdates(
  tenantId: ImportTenantId,
  importBatchId: string,
  updates: PreparedUpdate[],
  dryRun: boolean,
): { updatedOffers: number; updatedSnapshots: number } {
  if (dryRun || updates.length === 0) {
    return {
      updatedOffers: 0,
      updatedSnapshots: 0,
    };
  }

  const updateOffersStatement = db.prepare(`
    UPDATE vehicle_offers
    SET vehicle_type = @vehicle_type
    WHERE tenant_id = @tenant_id
      AND import_batch_id = @import_batch_id
      AND offer_code = @offer_code
  `);

  const updateSnapshotsStatement = db.prepare(`
    UPDATE vehicle_offer_snapshots
    SET vehicle_type = @vehicle_type
    WHERE tenant_id = @tenant_id
      AND import_batch_id = @import_batch_id
      AND offer_code = @offer_code
  `);

  return db.transaction(() => {
    let updatedOffers = 0;
    let updatedSnapshots = 0;

    updates.forEach((update) => {
      const params = {
        tenant_id: tenantId,
        import_batch_id: importBatchId,
        offer_code: update.offerCode,
        vehicle_type: update.vehicleType,
      };

      updatedOffers += updateOffersStatement.run(params).changes;
      updatedSnapshots += updateSnapshotsStatement.run(params).changes;
    });

    return {
      updatedOffers,
      updatedSnapshots,
    };
  })();
}

async function main(): Promise<void> {
  const options = parseCliOptions();
  const targetBatchId = resolveTargetBatchId(options.tenantId, options.importBatchId);

  // eslint-disable-next-line no-console
  console.log("vtb_vehicle_type_backfill_started", {
    tenantId: options.tenantId,
    targetBatchId,
    dryRun: options.dryRun,
    pageLimit: options.pageLimit,
    timeoutMs: options.timeoutMs,
    delayMs: options.delayMs,
  });

  const mapping = await buildUrlToVehicleTypeMap(options);
  const plan = buildUpdatePlan(options.tenantId, targetBatchId, mapping.urlToVehicleType);
  const applied = applyUpdates(
    options.tenantId,
    targetBatchId,
    plan.preparedUpdates,
    options.dryRun,
  );

  // eslint-disable-next-line no-console
  console.log("vtb_vehicle_type_backfill_result", {
    tenantId: options.tenantId,
    targetBatchId,
    dryRun: options.dryRun,
    categoriesDetected: mapping.categories,
    processedPages: mapping.processedPages,
    mappedUrls: mapping.urlToVehicleType.size,
    ambiguousUrls: mapping.ambiguousUrls.length,
    ambiguousUrlSamples: mapping.ambiguousUrls.slice(0, 10),
    totalOffersInBatch: plan.totalOffersInBatch,
    withWebsiteUrl: plan.withWebsiteUrl,
    matchedByUrl: plan.matchedByUrl,
    notMatchedByUrl: plan.notMatchedByUrl,
    unchangedByType: plan.unchangedByType,
    preparedUpdates: plan.preparedUpdates.length,
    updatedOffers: applied.updatedOffers,
    updatedSnapshots: applied.updatedSnapshots,
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("vtb_vehicle_type_backfill_failed", error);
  process.exitCode = 1;
});
