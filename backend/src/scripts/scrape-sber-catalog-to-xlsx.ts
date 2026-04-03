import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { REQUIRED_IMPORT_FIELDS, type CanonicalField } from "../domain/types";

const SBER_BASE_URL = "https://www.sberleasing.ru";
const SBER_CATALOG_PATH = "/realizaciya-imushestva/";
const DEFAULT_PAGE_LIMIT = 500;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_DELAY_MS = 150;
const CURRENT_YEAR = new Date().getFullYear();

interface ScriptOptions {
  outputPath: string;
  pageLimit: number;
  maxItems: number | null;
  timeoutMs: number;
  delayMs: number;
}

interface ItemProp {
  label: string;
  value: string;
}

interface ParsedSberItem {
  externalId: string;
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
}

type ExportRow = Record<CanonicalField, string | number | boolean | null>;

const EXPORT_HEADERS: CanonicalField[] = [...REQUIRED_IMPORT_FIELDS];

const VEHICLE_TYPE_BY_SLUG: Record<string, string> = {
  "legkovoy-avtotransport": "ЛЕГКОВОЙ ТРАНСПОРТ",
  "legkiy-kommercheskiy-transport": "ЛЕГКИЙ КОММЕРЧЕСКИЙ ТРАНСПОРТ",
  "gruzovoy-transport": "ГРУЗОВОЙ ТРАНСПОРТ",
  tyagachi: "ТЯГАЧИ",
  samosvaly: "САМОСВАЛЫ",
  pricepy: "ПРИЦЕПЫ",
  polupricepy: "ПОЛУПРИЦЕПЫ",
  avtobusy: "АВТОБУСЫ",
  "dorozhno-stroitelnaya-tekhnika": "СПЕЦТЕХНИКА",
  spetstekhnika: "СПЕЦТЕХНИКА",
};

function parseOptions(argv: string[]): ScriptOptions {
  const datePart = new Date().toISOString().slice(0, 10);
  const options: ScriptOptions = {
    outputPath: path.resolve(
      process.cwd(),
      `tmp/sber-catalog-${datePart}.xlsx`,
    ),
    pageLimit: DEFAULT_PAGE_LIMIT,
    maxItems: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    delayMs: DEFAULT_DELAY_MS,
  };

  argv.forEach((argument) => {
    if (argument.startsWith("--output=")) {
      const raw = argument.slice("--output=".length).trim();
      if (raw) {
        options.outputPath = path.resolve(process.cwd(), raw);
      }
      return;
    }

    if (argument.startsWith("--pageLimit=")) {
      const parsed = Number(argument.slice("--pageLimit=".length).trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        options.pageLimit = Math.max(1, Math.floor(parsed));
      }
      return;
    }

    if (argument.startsWith("--maxItems=")) {
      const parsed = Number(argument.slice("--maxItems=".length).trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxItems = Math.max(1, Math.floor(parsed));
      }
      return;
    }

    if (argument.startsWith("--timeoutMs=")) {
      const parsed = Number(argument.slice("--timeoutMs=".length).trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        options.timeoutMs = Math.max(1_000, Math.floor(parsed));
      }
      return;
    }

    if (argument.startsWith("--delayMs=")) {
      const parsed = Number(argument.slice("--delayMs=".length).trim());
      if (Number.isFinite(parsed) && parsed >= 0) {
        options.delayMs = Math.max(0, Math.floor(parsed));
      }
    }
  });

  return options;
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
    .replace(/&gt;/gi, ">");

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

function isLikelyVin(rawValue: string): boolean {
  const value = rawValue.trim().toUpperCase();
  if (!/^[A-Z0-9]{11,20}$/.test(value)) {
    return false;
  }
  if (!/[A-Z]/.test(value)) {
    return false;
  }
  return /\d/.test(value);
}

function toAbsoluteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `${SBER_BASE_URL}${trimmed}`;
  }
  return `${SBER_BASE_URL}/${trimmed}`;
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

function extractProps(cardHtml: string): ItemProp[] {
  const props: ItemProp[] = [];
  const propRegex =
    /<div class="realization__item-prop">[\s\S]*?<div class="realization__item-prop-name">\s*<span>([\s\S]*?)<\/span>[\s\S]*?<div class="realization__item-prop-val">([\s\S]*?)<\/div>/gi;

  let match: RegExpExecArray | null;
  while (true) {
    match = propRegex.exec(cardHtml);
    if (!match) {
      break;
    }

    const label = normalizeText(match[1] ?? "");
    const value = normalizeText(match[2] ?? "");
    if (!label || !value) {
      continue;
    }

    props.push({ label, value });
  }

  return props;
}

function findPropValue(
  props: ItemProp[],
  candidateNeedles: string[],
): string {
  for (const prop of props) {
    const normalizedLabel = normalizeLabelKey(prop.label);
    if (candidateNeedles.some((needle) => normalizedLabel.includes(needle))) {
      return prop.value;
    }
  }

  return "";
}

function parseYearFromProps(props: ItemProp[]): number | null {
  const direct = parseInteger(findPropValue(props, ["год", "year"]));
  if (direct && direct >= 1950 && direct <= CURRENT_YEAR + 1) {
    return direct;
  }

  for (const prop of props) {
    const match = prop.value.match(/\b(19\d{2}|20\d{2})\b/);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed >= 1950 && parsed <= CURRENT_YEAR + 1) {
      return parsed;
    }
  }

  return null;
}

function parseMileageFromProps(
  props: ItemProp[],
  year: number | null,
): number | null {
  const direct = parseInteger(findPropValue(props, ["пробег", "mileage"]));
  if (direct !== null) {
    return direct;
  }

  for (const prop of props) {
    const value = parseInteger(prop.value);
    if (value === null) {
      continue;
    }
    if (year !== null && value === year) {
      continue;
    }
    if (value < 100 || value > 5_000_000) {
      continue;
    }
    return value;
  }

  return null;
}

function parseVehicleTypeByUrl(detailUrl: string): string {
  if (!detailUrl) {
    return "СПЕЦТЕХНИКА";
  }

  const match = detailUrl.match(/\/realizaciya-imushestva\/([^/?#]+)/i);
  if (!match?.[1]) {
    return "СПЕЦТЕХНИКА";
  }

  const slug = match[1].trim().toLowerCase();
  return VEHICLE_TYPE_BY_SLUG[slug] ?? "СПЕЦТЕХНИКА";
}

function parseCardItem(cardHtml: string): ParsedSberItem | null {
  const externalId = normalizeText(
    cardHtml.match(/\bdata-offer-id="([^"]+)"/i)?.[1] ?? "",
  );

  const title = normalizeText(
    cardHtml.match(/class="realization__item-name"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "",
  );

  const detailPath = normalizeText(
    cardHtml.match(/<a[^>]*href="([^"]*\/realizaciya-imushestva\/[^"]*)"[^>]*>/i)?.[1] ??
      "",
  );
  const websiteUrl = toAbsoluteUrl(detailPath);

  const locationMatch =
    cardHtml.match(
      /<div class="realization__item-location">\s*<div class="realization__item-location">([\s\S]*?)<\/div>\s*<\/div>/i,
    ) ??
    cardHtml.match(/class="realization__item-location"[^>]*>([\s\S]*?)<\/div>/i);
  const storageAddress = normalizeText(locationMatch?.[1] ?? "");

  const reserveBadgeText = normalizeText(
    cardHtml.match(/class="realization__item-image-sales-new"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
      "",
  );
  const isReserved = reserveBadgeText.length > 0;

  const priceMatches = Array.from(
    cardHtml.matchAll(
      /class="realization__item-price-val(?:\s+[^"]*)?"[^>]*>([\s\S]*?)<\/div>/gi,
    ),
  );
  const priceCandidates = priceMatches
    .map((match) => parseInteger(normalizeText(match[1] ?? "")))
    .filter((value): value is number => value !== null);
  const price =
    priceCandidates.find((value) => value >= 100_000) ??
    priceCandidates[0] ??
    null;

  const imageUrls = Array.from(
    cardHtml.matchAll(/<img[^>]+src="([^"]+)"/gi),
  )
    .map((match) => toAbsoluteUrl(match[1] ?? ""))
    .filter((value) => value.length > 0);
  const mediaSource = Array.from(new Set(imageUrls)).join("\n");

  const props = extractProps(cardHtml);
  const brandFromProp = findPropValue(props, ["марк", "brand"]);
  const modelFromProp = findPropValue(props, ["модел", "model"]);
  const vinFromProp = findPropValue(props, ["vin"]);

  const propsTextValues = props
    .map((item) => item.value.trim())
    .filter((value) => value.length > 0);
  const fallbackBrand = propsTextValues[0] ?? "";
  const fallbackModel = propsTextValues[1] ?? "";

  const brand = brandFromProp || fallbackBrand;
  const model = modelFromProp || fallbackModel;

  const vinFromValues = propsTextValues.find((value) => isLikelyVin(value)) ?? "";
  const vinCandidate = isLikelyVin(vinFromProp)
    ? vinFromProp.toUpperCase()
    : isLikelyVin(vinFromValues)
      ? vinFromValues.toUpperCase()
      : "";

  const year = parseYearFromProps(props);
  const mileageKm = parseMileageFromProps(props, year);
  const vehicleType = parseVehicleTypeByUrl(detailPath);

  const offerCode =
    vinCandidate ||
    externalId ||
    normalizeText(
      detailPath.match(/-(\d+)\/?$/)?.[1] ?? "",
    );

  if (!offerCode) {
    return null;
  }

  return {
    externalId,
    offerCode,
    status: isReserved ? "Забронировано" : "В продаже",
    bookingStatus: isReserved ? "Резерв" : "Свободен",
    brand,
    model,
    modification: model || title,
    vehicleType,
    year,
    mileageKm,
    price,
    storageAddress,
    websiteUrl,
    mediaSource,
  };
}

function toExportRow(item: ParsedSberItem): ExportRow {
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
    external_id: item.externalId || item.offerCode,
    crm_ref: "",
    website_url: item.websiteUrl,
  };
}

function buildPageUrl(page: number): string {
  if (page <= 1) {
    return `${SBER_BASE_URL}${SBER_CATALOG_PATH}?set_filter=y&scrollto=sbl-filter-car-count`;
  }

  return `${SBER_BASE_URL}${SBER_CATALOG_PATH}?PAGEN_1=${page}&set_filter=y&scrollto=sbl-filter-car-count&ajaxload=y`;
}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<string> {
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

function extractNextPageNumber(html: string): number | null {
  const tagMatch = html.match(
    /<div[^>]*(?:class="add-new-page"[^>]*url="[^"]+"|url="[^"]+"[^>]*class="add-new-page")[^>]*>/i,
  );
  if (!tagMatch?.[0]) {
    return null;
  }

  const rawUrl = tagMatch[0].match(/\burl="([^"]+)"/i)?.[1] ?? "";
  if (!rawUrl) {
    return null;
  }

  const decodedUrl = decodeHtmlEntities(rawUrl);

  try {
    const absolute = new URL(decodedUrl, SBER_BASE_URL);
    const pageValue = absolute.searchParams.get("PAGEN_1");
    if (!pageValue) {
      return null;
    }

    const parsed = Number(pageValue);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return null;
    }

    return Math.floor(parsed);
  } catch {
    return null;
  }
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

async function collectSberItems(options: ScriptOptions): Promise<ParsedSberItem[]> {
  const itemsByOfferCode = new Map<string, ParsedSberItem>();
  let page = 1;

  while (page <= options.pageLimit) {
    const pageUrl = buildPageUrl(page);
    const html = await fetchTextWithTimeout(pageUrl, options.timeoutMs);
    const cardBlocks = extractDivBlocksByClass(html, "realization__item");

    if (cardBlocks.length === 0) {
      console.log("sber_scrape_page_empty", { page, pageUrl });
      break;
    }

    let pageAdded = 0;
    for (const cardHtml of cardBlocks) {
      const item = parseCardItem(cardHtml);
      if (!item) {
        continue;
      }

      if (!itemsByOfferCode.has(item.offerCode)) {
        itemsByOfferCode.set(item.offerCode, item);
        pageAdded += 1;
      }

      if (options.maxItems !== null && itemsByOfferCode.size >= options.maxItems) {
        console.log("sber_scrape_max_items_reached", {
          maxItems: options.maxItems,
        });
        return Array.from(itemsByOfferCode.values());
      }
    }

    const nextPage = extractNextPageNumber(html);
    console.log("sber_scrape_page_done", {
      page,
      cardsFound: cardBlocks.length,
      added: pageAdded,
      totalUnique: itemsByOfferCode.size,
      nextPage,
    });

    if (!nextPage || nextPage <= page) {
      break;
    }

    page = nextPage;
    await sleep(options.delayMs);
  }

  return Array.from(itemsByOfferCode.values());
}

function writeWorkbook(outputPath: string, rows: ExportRow[]): void {
  const workbook = XLSX.utils.book_new();
  const sheetRows = toSheetRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows, {
    header: EXPORT_HEADERS,
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "sber_catalog");
  mkdirSync(path.dirname(outputPath), { recursive: true });

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(outputPath, buffer);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  console.log("sber_scrape_started", options);

  const items = await collectSberItems(options);
  const exportRows = items.map((item) => toExportRow(item));

  writeWorkbook(options.outputPath, exportRows);

  const stats = {
    totalItems: items.length,
    withPrice: items.filter((item) => item.price !== null).length,
    withYear: items.filter((item) => item.year !== null).length,
    withMileage: items.filter((item) => item.mileageKm !== null).length,
    withMedia: items.filter((item) => item.mediaSource.trim().length > 0).length,
    reserved: items.filter((item) => item.bookingStatus === "Резерв").length,
    outputPath: options.outputPath,
  };

  console.log("sber_scrape_completed", stats);
}

void main().catch((error) => {
  console.log("sber_scrape_failed", {
    error: error instanceof Error ? error.message : "unknown_error",
  });
  process.exitCode = 1;
});
