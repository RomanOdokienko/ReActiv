import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { REQUIRED_IMPORT_FIELDS, type CanonicalField } from "../domain/types";

const VTB_BASE_URL = "https://www.vtb-leasing.ru";
const VTB_MARKET_PATH = "/market/";
const DEFAULT_PAGE_LIMIT = 300;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_DELAY_MS = 120;
const DEFAULT_DETAIL_CONCURRENCY = 6;
const CURRENT_YEAR = new Date().getFullYear();

export interface VtbScrapeOptions {
  outputPath?: string;
  pageLimit?: number;
  maxItems?: number | null;
  timeoutMs?: number;
  delayMs?: number;
  detailConcurrency?: number;
}

interface ScriptOptions {
  outputPath: string;
  pageLimit: number;
  maxItems: number | null;
  timeoutMs: number;
  delayMs: number;
  detailConcurrency: number;
}

interface VtbSpecRow {
  label: string;
  value: string;
}

interface ParsedVtbItem {
  offerCode: string;
  status: string;
  bookingStatus: string;
  brand: string;
  model: string;
  modification: string;
  vehicleType: string;
  year: number | null;
  mileageKm: number | null;
  price: number | null;
  storageAddress: string;
  websiteUrl: string;
  mediaSource: string;
  externalId: string;
}

interface VtbDetailLink {
  relativePath: string;
  categoryPath: string;
}

type ExportRow = Record<CanonicalField, string | number | boolean | null>;

export interface VtbScrapeProgress {
  stage: "listing" | "details";
  processed: number;
  total: number;
}

export interface VtbScrapeResult {
  itemsCount: number;
  withPrice: number;
  withYear: number;
  withMileage: number;
  withMedia: number;
  fileBuffer: Buffer;
  outputPath?: string;
}

const EXPORT_HEADERS: CanonicalField[] = [...REQUIRED_IMPORT_FIELDS];

function clampPositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function clampNonNegativeInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

export function resolveVtbScrapeOptions(
  input: VtbScrapeOptions = {},
): ScriptOptions {
  const datePart = new Date().toISOString().slice(0, 10);
  const maxItems =
    typeof input.maxItems === "number" && Number.isFinite(input.maxItems) && input.maxItems > 0
      ? Math.floor(input.maxItems)
      : null;

  const outputPath = input.outputPath?.trim()
    ? path.resolve(process.cwd(), input.outputPath)
    : path.resolve(process.cwd(), `tmp/vtb-market-${datePart}.xlsx`);

  return {
    outputPath,
    pageLimit: clampPositiveInt(input.pageLimit, DEFAULT_PAGE_LIMIT),
    maxItems,
    timeoutMs: clampPositiveInt(input.timeoutMs, DEFAULT_TIMEOUT_MS),
    delayMs: clampNonNegativeInt(input.delayMs, DEFAULT_DELAY_MS),
    detailConcurrency: clampPositiveInt(
      input.detailConcurrency,
      DEFAULT_DETAIL_CONCURRENCY,
    ),
  };
}

function parseOptions(argv: string[]): ScriptOptions {
  const nextOptions: VtbScrapeOptions = {};

  argv.forEach((argument) => {
    if (argument.startsWith("--output=")) {
      const raw = argument.slice("--output=".length).trim();
      if (raw) {
        nextOptions.outputPath = raw;
      }
      return;
    }

    if (argument.startsWith("--pageLimit=")) {
      const value = Number(argument.slice("--pageLimit=".length).trim());
      if (Number.isFinite(value) && value > 0) {
        nextOptions.pageLimit = Math.max(1, Math.floor(value));
      }
      return;
    }

    if (argument.startsWith("--maxItems=")) {
      const value = Number(argument.slice("--maxItems=".length).trim());
      if (Number.isFinite(value) && value > 0) {
        nextOptions.maxItems = Math.max(1, Math.floor(value));
      }
      return;
    }

    if (argument.startsWith("--timeoutMs=")) {
      const value = Number(argument.slice("--timeoutMs=".length).trim());
      if (Number.isFinite(value) && value > 0) {
        nextOptions.timeoutMs = Math.max(1_000, Math.floor(value));
      }
      return;
    }

    if (argument.startsWith("--delayMs=")) {
      const value = Number(argument.slice("--delayMs=".length).trim());
      if (Number.isFinite(value) && value >= 0) {
        nextOptions.delayMs = Math.max(0, Math.floor(value));
      }
      return;
    }

    if (argument.startsWith("--detailConcurrency=")) {
      const value = Number(argument.slice("--detailConcurrency=".length).trim());
      if (Number.isFinite(value) && value > 0) {
        nextOptions.detailConcurrency = Math.max(1, Math.floor(value));
      }
    }
  });

  return resolveVtbScrapeOptions(nextOptions);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function decodeHtmlEntities(value: string): string {
  const withNamed = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8381;/g, " ₽ ");

  const withDecimal = withNamed.replace(/&#(\d+);/g, (_match, code) => {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
  });

  return withDecimal.replace(/&#x([0-9a-f]+);/gi, (_match, hex) => {
    const parsed = Number.parseInt(hex, 16);
    return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
  });
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(stripHtml(value))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabelKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim();
}

function parseInteger(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function toAbsoluteUrl(rawUrl: string): string {
  const trimmed = decodeHtmlEntities(rawUrl).trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/^['"]|['"]$/g, "").trim();
  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }

  if (normalized.startsWith("/")) {
    return `${VTB_BASE_URL}${normalized}`;
  }

  return `${VTB_BASE_URL}/${normalized}`;
}

function extractDivBlocksByClass(html: string, className: string): string[] {
  const blocks: string[] = [];
  const classToken = `class="${className}"`;
  let searchStart = 0;

  while (searchStart < html.length) {
    const classIndex = html.indexOf(classToken, searchStart);
    if (classIndex < 0) {
      break;
    }

    const divStart = html.lastIndexOf("<div", classIndex);
    if (divStart < 0) {
      searchStart = classIndex + classToken.length;
      continue;
    }

    let cursor = divStart;
    let depth = 0;
    let blockEnd = -1;

    while (cursor < html.length) {
      const openIndex = html.indexOf("<div", cursor);
      const closeIndex = html.indexOf("</div>", cursor);
      if (closeIndex < 0) {
        break;
      }

      if (openIndex >= 0 && openIndex < closeIndex) {
        depth += 1;
        cursor = openIndex + 4;
        continue;
      }

      depth -= 1;
      cursor = closeIndex + "</div>".length;
      if (depth === 0) {
        blockEnd = cursor;
        break;
      }
    }

    if (blockEnd <= divStart) {
      searchStart = classIndex + classToken.length;
      continue;
    }

    blocks.push(html.slice(divStart, blockEnd));
    searchStart = blockEnd;
  }

  return blocks;
}

function runConcurrently<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
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
      await worker(items[currentIndex], currentIndex);
    }
  });

  return Promise.all(workers).then(() => undefined);
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

function extractHrefValues(html: string): string[] {
  return [...html.matchAll(/href=['"]([^'"]+)['"]/gi)]
    .map((match) => decodeHtmlEntities(match[1] ?? "").trim())
    .filter(Boolean);
}

function extractAnchorTags(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/gi)]
    .map((match) => match[0] ?? "")
    .filter(Boolean);
}

function extractAnchorHrefsByClass(html: string, classFragment: string): string[] {
  const links: string[] = [];
  const tags = extractAnchorTags(html);

  tags.forEach((tag) => {
    const classAttrRaw = tag.match(/\bclass=['"]([^'"]+)['"]/i)?.[1] ?? "";
    const classAttr = decodeHtmlEntities(classAttrRaw);
    if (!classAttr.includes(classFragment)) {
      return;
    }

    const hrefRaw = tag.match(/\bhref=['"]([^'"]+)['"]/i)?.[1] ?? "";
    const href = decodeHtmlEntities(hrefRaw).trim();
    if (!href) {
      return;
    }

    links.push(href);
  });

  return links;
}

function resolvePagerPath(html: string): string {
  const hrefs = extractHrefValues(html);
  for (const href of hrefs) {
    if (!/PAGEN_1=\d+/i.test(href)) {
      continue;
    }

    try {
      const parsed = new URL(href, VTB_BASE_URL);
      if (parsed.pathname.startsWith("/market/")) {
        return parsed.pathname;
      }
    } catch {
      continue;
    }
  }

  return "/market/f/type-is-4/";
}

function normalizeMarketPath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return VTB_MARKET_PATH;
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function extractTypeFilterPaths(rootHtml: string): string[] {
  const fallbackPath = normalizeMarketPath(resolvePagerPath(rootHtml));
  const bindMatch = rootHtml.match(/<market-smart-filter[^>]*v-bind="([^"]+)"/i);
  if (!bindMatch) {
    return [fallbackPath];
  }

  try {
    const decodedBindJson = decodeHtmlEntities(bindMatch[1] ?? "");
    const parsed = JSON.parse(decodedBindJson) as {
      items?: Array<Record<string, unknown>>;
    };

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const typeItem = items.find((item) => {
      const code = typeof item.CODE === "string" ? item.CODE : "";
      return code.trim().toUpperCase() === "TYPE";
    });

    const rawValues = typeItem?.VALUES;
    const values = Array.isArray(rawValues) ? rawValues : [];
    const paths = values
      .map((value) => {
        const record = value as Record<string, unknown>;
        const rawUrlId = String(record.URL_ID ?? "").trim();
        if (!rawUrlId) {
          return "";
        }

        return normalizeMarketPath(`/market/f/type-is-${rawUrlId}/`);
      })
      .filter(Boolean);

    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length > 0) {
      return uniquePaths;
    }

    return [fallbackPath];
  } catch {
    return [fallbackPath];
  }
}

function extractLastPageNumber(html: string): number {
  const hrefs = extractHrefValues(html);
  const pageNumbers = hrefs
    .map((href) => {
      try {
        const parsed = new URL(href, VTB_BASE_URL);
        const value = parsed.searchParams.get("PAGEN_1");
        if (!value) {
          return null;
        }
        const parsedValue = Number(value);
        return Number.isFinite(parsedValue) && parsedValue > 0
          ? Math.floor(parsedValue)
          : null;
      } catch {
        return null;
      }
    })
    .filter((value): value is number => value !== null);

  if (pageNumbers.length === 0) {
    return 1;
  }

  return Math.max(...pageNumbers);
}

function buildMarketPageUrl(page: number, pagerPath: string): string {
  const normalizedPath = normalizeMarketPath(pagerPath);
  if (page <= 1) {
    return `${VTB_BASE_URL}${normalizedPath}`;
  }
  return `${VTB_BASE_URL}${normalizedPath}?PAGEN_1=${page}`;
}

function isVtbDetailPath(pathname: string): boolean {
  if (!pathname || pathname === "/" || pathname === "/market/" || pathname === "/market") {
    return false;
  }

  if (pathname.startsWith("/market/f/")) {
    return false;
  }

  if (pathname.startsWith("/market/")) {
    return true;
  }

  if (pathname.startsWith("/auto/probeg/")) {
    return true;
  }

  return false;
}

function normalizeRelativePath(href: string): string {
  try {
    const parsed = new URL(href, VTB_BASE_URL);
    const pathname = parsed.pathname;
    if (!pathname) {
      return "";
    }
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  } catch {
    return "";
  }
}

function extractMarketItemRelativeLinks(html: string): string[] {
  const cardLinkHrefs = extractAnchorHrefsByClass(html, "t-market-item-bottom-link");
  const cardLinks = cardLinkHrefs
    .map((href) => normalizeRelativePath(href))
    .filter((pathname) => isVtbDetailPath(pathname));

  if (cardLinks.length > 0) {
    return [...new Set(cardLinks)];
  }

  const fallbackLinks = extractHrefValues(html)
    .map((href) => normalizeRelativePath(href))
    .filter((pathname) => isVtbDetailPath(pathname))
    .filter((pathname) => !/\.(?:css|js|png|jpe?g|webp|svg|gif|ico)$/i.test(pathname));

  return [...new Set(fallbackLinks)];
}

function parseBrandModel(title: string): { brand: string; model: string } {
  const normalized = normalizeText(title);
  if (!normalized) {
    return { brand: "", model: "" };
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    return { brand: tokens[0], model: tokens[0] };
  }

  return {
    brand: tokens[0],
    model: tokens.slice(1).join(" "),
  };
}

function extractTypeCodeFromCategoryPath(categoryPath: string): string {
  const match = categoryPath.match(/type-is-(\d+)/i);
  return match?.[1] ?? "";
}

function mapTypeCodeToVehicleType(typeCode: string): string | null {
  switch (typeCode) {
    case "1":
      return "Автобус";
    case "2":
      return "Грузовой";
    case "3":
      return "ЛКТ";
    case "4":
      return "Легковой";
    case "5":
      return "Прицеп";
    case "6":
      return "СПЕЦТЕХНИКА";
    default:
      return null;
  }
}

function resolveVtbVehicleType(categoryPath: string, typeFromSpec: string): string {
  const specValue = normalizeText(typeFromSpec);
  if (specValue) {
    return specValue;
  }

  const typeCode = extractTypeCodeFromCategoryPath(categoryPath);
  return mapTypeCodeToVehicleType(typeCode) ?? "Легковой";
}

function mapAvailabilityToStatus(availability: string): {
  status: string;
  bookingStatus: string;
} {
  const normalized = normalizeLabelKey(availability);

  if (normalized.includes("резерв") || normalized.includes("заброни")) {
    return { status: "Забронировано", bookingStatus: "Резерв" };
  }

  if (normalized.includes("продан") || normalized.includes("реализ")) {
    return { status: "Продано", bookingStatus: "Недоступен" };
  }

  if (normalized.includes("доступно")) {
    return { status: "В продаже", bookingStatus: "Свободен" };
  }

  return { status: "В продаже", bookingStatus: "Свободен" };
}

function parseSpecRows(autoCardHtml: string): VtbSpecRow[] {
  const blocks = extractDivBlocksByClass(autoCardHtml, "t-tab-content-column-item");
  const rows: VtbSpecRow[] = [];

  blocks.forEach((block) => {
    const labelRaw = block.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const label = normalizeText(labelRaw);
    if (!label) {
      return;
    }

    const valueRaw = block.replace(/<div>\s*<span[\s\S]*?<\/span>\s*<\/div>/i, "");
    let value = normalizeText(valueRaw);
    value = value.replace(/Записаться на осмотр/gi, "").trim();

    rows.push({ label, value });
  });

  return rows;
}

function findSpecValue(specRows: VtbSpecRow[], labelNeedles: string[]): string {
  const normalizedNeedles = labelNeedles.map((item) => normalizeLabelKey(item));

  for (const row of specRows) {
    const normalizedLabel = normalizeLabelKey(row.label);
    if (normalizedNeedles.some((needle) => normalizedLabel.includes(needle))) {
      return row.value;
    }
  }

  return "";
}

function parseSummaryMeta(autoCardHtml: string): {
  year: number | null;
  mileageKm: number | null;
  city: string;
} {
  const propsBlocks = extractDivBlocksByClass(autoCardHtml, "t-auto-card-title-props");
  const summaryRaw = normalizeText(propsBlocks[0] ?? "");

  const yearMatch = summaryRaw.match(/\b(19\d{2}|20\d{2})\b/);
  const mileageMatch = summaryRaw.match(/([\d\s]{2,10})\s*км/i);
  const parts = summaryRaw.split("/").map((item) => item.trim()).filter(Boolean);
  const city = parts[parts.length - 1] ?? "";

  const yearCandidate = yearMatch ? Number(yearMatch[1]) : null;
  const year =
    yearCandidate !== null && yearCandidate >= 1950 && yearCandidate <= CURRENT_YEAR + 1
      ? yearCandidate
      : null;

  const mileage = mileageMatch ? parseInteger(mileageMatch[1]) : null;

  return {
    year,
    mileageKm: mileage,
    city,
  };
}

function parseGalleryUrls(autoCardHtml: string): string[] {
  const urls: string[] = [];

  const dataImagesMatches = [...autoCardHtml.matchAll(/data-images='([^']+)'/gi)];
  dataImagesMatches.forEach((match) => {
    const raw = decodeHtmlEntities(match[1] ?? "").trim();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw.replace(/\\\//g, "/")) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      parsed.forEach((item) => {
        if (typeof item !== "string") {
          return;
        }
        const absolute = toAbsoluteUrl(item);
        if (absolute) {
          urls.push(absolute);
        }
      });
    } catch {
      // Ignore malformed JSON payload.
    }
  });

  if (urls.length === 0) {
    const attrUrls = [...autoCardHtml.matchAll(/(?:src|data-src|data-lazy)=['"]([^'"]+)['"]/gi)]
      .map((match) => toAbsoluteUrl(match[1] ?? ""))
      .filter(Boolean);
    urls.push(...attrUrls);
  }

  const backgroundUrls = [...autoCardHtml.matchAll(/background-image:\s*url\(([^)]+)\)/gi)]
    .map((match) => toAbsoluteUrl(match[1] ?? ""))
    .filter(Boolean);
  urls.push(...backgroundUrls);

  return [...new Set(urls)]
    .filter((url) => /\/upload\//i.test(url))
    .filter((url) => /\.(?:png|jpe?g|webp|gif|bmp|svg)(?:\?|$)/i.test(url));
}

function parsePriceFromAutoCard(autoCardHtml: string): number | null {
  const candidateBlocks = [
    ...extractDivBlocksByClass(autoCardHtml, "t-market-auto-full-price"),
    ...extractDivBlocksByClass(autoCardHtml, "t-calculator-card-price"),
    ...extractDivBlocksByClass(autoCardHtml, "t-auto-card-price"),
    ...extractDivBlocksByClass(autoCardHtml, "t-market-auto-month-price"),
  ];

  for (const candidate of candidateBlocks) {
    const parsed = parseInteger(normalizeText(candidate));
    if (parsed !== null) {
      return parsed;
    }
  }

  const inlineMatch = autoCardHtml.match(/([\d\s]{3,})\s*(?:&#8381;|₽|руб)/i);
  if (inlineMatch?.[1]) {
    return parseInteger(inlineMatch[1]);
  }

  return null;
}

function parseVtbItem(
  detailRelativePath: string,
  categoryPath: string,
  html: string,
): ParsedVtbItem | null {
  const detailUrl = toAbsoluteUrl(detailRelativePath);
  const autoCardHtml = extractDivBlocksByClass(html, "t-auto-card")[0] ?? html;
  const titleRaw = autoCardHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const title = normalizeText(titleRaw);
  if (!title) {
    return null;
  }

  const specRows = parseSpecRows(autoCardHtml);
  const summaryMeta = parseSummaryMeta(autoCardHtml);

  const offerCodeFromSpec = findSpecValue(specRows, ["код предложения", "код лота"]);
  const vin = findSpecValue(specRows, ["vin"]).toUpperCase();
  const fallbackOfferCode = detailRelativePath.split("/").filter(Boolean).pop() ?? "";
  const offerCode = normalizeText(vin || offerCodeFromSpec || fallbackOfferCode);
  if (!offerCode) {
    return null;
  }

  const city = findSpecValue(specRows, ["город"]) || summaryMeta.city;
  const yearFromSpec = parseInteger(findSpecValue(specRows, ["год выпуска"]));
  const mileageFromSpec = parseInteger(findSpecValue(specRows, ["пробег"]));
  const priceFromSpec = parseInteger(findSpecValue(specRows, ["цена", "стоимость"]));
  const vehicleTypeFromSpec = findSpecValue(specRows, ["тип тс", "тип техники"]);
  const storageAddress = findSpecValue(specRows, ["адрес стоянки"]);
  const availabilityRaw =
    normalizeText(
      autoCardHtml.match(/<div[^>]*class="[^"]*t-market-item-flags-item[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
      "",
    ) || "Доступно для покупки";
  const { status, bookingStatus } = mapAvailabilityToStatus(availabilityRaw);
  const price =
    parsePriceFromAutoCard(autoCardHtml) ??
    parsePriceFromAutoCard(html) ??
    priceFromSpec;

  const galleryUrls = parseGalleryUrls(autoCardHtml);
  const mediaSource = galleryUrls.join("\n");
  const brandModel = parseBrandModel(title);

  const yearCandidate = yearFromSpec ?? summaryMeta.year;
  const year =
    yearCandidate !== null && yearCandidate >= 1950 && yearCandidate <= CURRENT_YEAR + 1
      ? yearCandidate
      : null;

  return {
    offerCode,
    status,
    bookingStatus,
    brand: brandModel.brand,
    model: brandModel.model,
    modification: title,
    vehicleType: resolveVtbVehicleType(categoryPath, vehicleTypeFromSpec),
    year,
    mileageKm: mileageFromSpec ?? summaryMeta.mileageKm,
    price,
    storageAddress: storageAddress || city,
    websiteUrl: detailUrl,
    mediaSource,
    externalId: offerCodeFromSpec || offerCode,
  };
}

function toExportRow(item: ParsedVtbItem): ExportRow {
  return {
    offer_code: item.offerCode,
    status: item.status,
    brand: item.brand,
    model: item.model,
    modification: item.modification,
    vehicle_type: item.vehicleType,
    year: item.year,
    mileage_km: item.mileageKm,
    key_count: null,
    pts_type: "",
    has_encumbrance: null,
    is_deregistered: null,
    responsible_person: "",
    storage_address: item.storageAddress,
    days_on_sale: null,
    price: item.price,
    yandex_disk_url: item.mediaSource,
    booking_status: item.bookingStatus,
    external_id: item.externalId,
    crm_ref: "",
    website_url: item.websiteUrl,
  };
}

function toSheetRows(rows: ExportRow[]): Array<Record<string, string | number | boolean | null>> {
  return rows.map((row) => {
    const ordered: Record<string, string | number | boolean | null> = {};
    EXPORT_HEADERS.forEach((field) => {
      ordered[field] = row[field] ?? "";
    });
    return ordered;
  });
}

function buildWorkbookBuffer(rows: ExportRow[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheetRows = toSheetRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows, {
    header: EXPORT_HEADERS,
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "vtb_market");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function writeWorkbook(outputPath: string, rows: ExportRow[]): void {
  mkdirSync(path.dirname(outputPath), { recursive: true });

  const buffer = buildWorkbookBuffer(rows);
  writeFileSync(outputPath, buffer);
}

async function collectMarketItemLinks(
  options: ScriptOptions,
  onProgress?: (progress: VtbScrapeProgress) => void,
): Promise<VtbDetailLink[]> {
  const rootHtml = await fetchTextWithTimeout(`${VTB_BASE_URL}${VTB_MARKET_PATH}`, options.timeoutMs);
  const categoryPaths = extractTypeFilterPaths(rootHtml);

  const itemLinks = new Map<string, VtbDetailLink>();
  let processedPages = 0;
  let totalPlannedPages = 0;
  let maxItemsReached = false;

  for (const categoryPath of categoryPaths) {
    const firstPageUrl = buildMarketPageUrl(1, categoryPath);
    const firstPageHtml = await fetchTextWithTimeout(firstPageUrl, options.timeoutMs);
    const lastPage = extractLastPageNumber(firstPageHtml);
    const targetPageCount = Math.max(1, Math.min(lastPage, options.pageLimit));
    totalPlannedPages += targetPageCount;

    for (let page = 1; page <= targetPageCount; page += 1) {
      const pageUrl = buildMarketPageUrl(page, categoryPath);
      const html =
        page === 1 ? firstPageHtml : await fetchTextWithTimeout(pageUrl, options.timeoutMs);
      const links = extractMarketItemRelativeLinks(html);
      links.forEach((link) => {
        if (!itemLinks.has(link)) {
          itemLinks.set(link, {
            relativePath: link,
            categoryPath,
          });
        }
      });
      processedPages += 1;

      console.log("vtb_scrape_list_page_done", {
        categoryPath,
        page,
        pageUrl,
        linksFound: links.length,
        totalUniqueLinks: itemLinks.size,
        targetPageCount,
        processedPages,
        totalPlannedPages,
      });
      onProgress?.({
        stage: "listing",
        processed: processedPages,
        total: Math.max(processedPages, totalPlannedPages),
      });

      if (options.maxItems !== null && itemLinks.size >= options.maxItems) {
        maxItemsReached = true;
        break;
      }

      if (page < targetPageCount) {
        await sleep(options.delayMs);
      }
    }

    if (maxItemsReached) {
      break;
    }

    await sleep(options.delayMs);
  }

  const collected = Array.from(itemLinks.values());
  if (options.maxItems !== null && collected.length > options.maxItems) {
    return collected.slice(0, options.maxItems);
  }

  return collected;
}

async function collectVtbItems(
  options: ScriptOptions,
  onProgress?: (progress: VtbScrapeProgress) => void,
): Promise<ParsedVtbItem[]> {
  const detailLinks = await collectMarketItemLinks(options, onProgress);
  const itemsByOfferCode = new Map<string, ParsedVtbItem>();
  let failedDetails = 0;

  await runConcurrently(
    detailLinks,
    options.detailConcurrency,
    async (detailLink, index) => {
      try {
        const relativePath = detailLink.relativePath;
        const detailUrl = toAbsoluteUrl(relativePath);
        const html = await fetchTextWithTimeout(detailUrl, options.timeoutMs);
        const parsed = parseVtbItem(relativePath, detailLink.categoryPath, html);
        if (!parsed) {
          failedDetails += 1;
        } else if (!itemsByOfferCode.has(parsed.offerCode)) {
          itemsByOfferCode.set(parsed.offerCode, parsed);
        }

        if ((index + 1) % 25 === 0 || index + 1 === detailLinks.length) {
          console.log("vtb_scrape_detail_progress", {
            processed: index + 1,
            total: detailLinks.length,
            parsedUniqueItems: itemsByOfferCode.size,
            failedDetails,
          });
          onProgress?.({
            stage: "details",
            processed: index + 1,
            total: detailLinks.length,
          });
        }
      } catch (error) {
        failedDetails += 1;
        console.log("vtb_scrape_detail_failed", {
          relativePath: detailLink.relativePath,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  if (failedDetails > 0) {
    console.log("vtb_scrape_detail_summary", {
      totalLinks: detailLinks.length,
      parsedUniqueItems: itemsByOfferCode.size,
      failedDetails,
    });
  }

  return Array.from(itemsByOfferCode.values());
}

export async function scrapeVtbMarketToWorkbook(
  options: VtbScrapeOptions = {},
  onProgress?: (progress: VtbScrapeProgress) => void,
): Promise<VtbScrapeResult> {
  const resolvedOptions = resolveVtbScrapeOptions(options);
  const items = await collectVtbItems(resolvedOptions, onProgress);
  const exportRows = items.map((item) => toExportRow(item));
  const fileBuffer = buildWorkbookBuffer(exportRows);

  return {
    itemsCount: items.length,
    withPrice: items.filter((item) => item.price !== null).length,
    withYear: items.filter((item) => item.year !== null).length,
    withMileage: items.filter((item) => item.mileageKm !== null).length,
    withMedia: items.filter((item) => item.mediaSource.trim().length > 0).length,
    fileBuffer,
    outputPath: resolvedOptions.outputPath,
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  console.log("vtb_scrape_started", options);

  const result = await scrapeVtbMarketToWorkbook(options);
  mkdirSync(path.dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, result.fileBuffer);

  const stats = {
    totalItems: result.itemsCount,
    withPrice: result.withPrice,
    withYear: result.withYear,
    withMileage: result.withMileage,
    withMedia: result.withMedia,
    outputPath: options.outputPath,
  };

  console.log("vtb_scrape_completed", stats);
}

if (require.main === module) {
  void main().catch((error) => {
    console.log("vtb_scrape_failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    process.exitCode = 1;
  });
}

