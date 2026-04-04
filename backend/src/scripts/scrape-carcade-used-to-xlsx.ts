import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { REQUIRED_IMPORT_FIELDS, type CanonicalField } from "../domain/types";

const CARCADE_BASE_URL = "https://www.carcade.com";
const CARCADE_USED_PATH = "/avto_s_probegom";
const CARCADE_FILTER_URL = `${CARCADE_BASE_URL}/api/catalog/filter/used`;
const CARCADE_LIST_URL = `${CARCADE_BASE_URL}/api/useds/`;
const DEFAULT_PAGE_LIMIT = 500;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_DELAY_MS = 300;
const CURRENT_YEAR = new Date().getFullYear();

export interface CarcadeScrapeOptions {
  outputPath?: string;
  pageLimit?: number;
  maxItems?: number | null;
  timeoutMs?: number;
  delayMs?: number;
}

interface ScriptOptions {
  outputPath: string;
  pageLimit: number;
  maxItems: number | null;
  timeoutMs: number;
  delayMs: number;
}

interface CarcadeFilterType {
  id: number;
  name: string;
  code: string;
  count: number;
  active: boolean;
}

interface CarcadeFilterResponse {
  filter?: {
    types?: CarcadeFilterType[];
  };
}

interface CarcadeListAttribute {
  title?: string;
  value?: string;
}

interface CarcadeListItem {
  id?: number | string;
  brand?: string;
  model?: string;
  year?: number | string | null;
  city?: string | null;
  picture?: string | null;
  price?: number | string | null;
  dl?: string | null;
  reservdate?: string | null;
  attrs?: CarcadeListAttribute[];
}

interface CarcadeListResponse {
  items?: CarcadeListItem[];
  pageCnt?: number;
  totalCnt?: number;
}

interface ParsedCarcadeItem {
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

type ExportRow = Record<CanonicalField, string | number | boolean | null>;

export interface CarcadeScrapeProgress {
  stage: "listing";
  processed: number;
  total: number;
}

export interface CarcadeScrapeResult {
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

export function resolveCarcadeScrapeOptions(
  input: CarcadeScrapeOptions = {},
): ScriptOptions {
  const datePart = new Date().toISOString().slice(0, 10);
  const maxItems =
    typeof input.maxItems === "number" && Number.isFinite(input.maxItems) && input.maxItems > 0
      ? Math.floor(input.maxItems)
      : null;

  const outputPath = input.outputPath?.trim()
    ? path.resolve(process.cwd(), input.outputPath)
    : path.resolve(process.cwd(), `tmp/carcade-catalog-${datePart}.xlsx`);

  return {
    outputPath,
    pageLimit: clampPositiveInt(input.pageLimit, DEFAULT_PAGE_LIMIT),
    maxItems,
    timeoutMs: clampPositiveInt(input.timeoutMs, DEFAULT_TIMEOUT_MS),
    delayMs: clampNonNegativeInt(input.delayMs, DEFAULT_DELAY_MS),
  };
}

function parseOptions(argv: string[]): ScriptOptions {
  const nextOptions: CarcadeScrapeOptions = {};

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
    }
  });

  return resolveCarcadeScrapeOptions(nextOptions);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(rawUrl: string): string {
  const trimmed = normalizeText(rawUrl);
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return `${CARCADE_BASE_URL}${trimmed}`;
  }

  return `${CARCADE_BASE_URL}/${trimmed}`;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.floor(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

function parseYear(rawValue: unknown): number | null {
  const parsed = parseInteger(rawValue);
  if (parsed === null) {
    return null;
  }

  if (parsed < 1950 || parsed > CURRENT_YEAR + 1) {
    return null;
  }

  return parsed;
}

function parseMileageFromAttributes(attributes: CarcadeListAttribute[] | undefined): number | null {
  if (!Array.isArray(attributes) || attributes.length === 0) {
    return null;
  }

  for (const attribute of attributes) {
    const title = normalizeText(attribute.title).toLowerCase();
    if (!title.includes("пробег")) {
      continue;
    }

    return parseInteger(attribute.value);
  }

  return null;
}

function normalizeTypeCode(rawCode: string): string {
  return normalizeText(rawCode).toLowerCase();
}

function mapTypeCodeToVehicleType(typeCode: string): string {
  const normalized = normalizeTypeCode(typeCode);
  if (normalized === "legkovye") {
    return "ЛЕГКОВОЙ";
  }
  if (normalized === "gruzovye") {
    return "ГРУЗОВОЙ";
  }
  if (normalized === "legkij_kommercheskij_transport") {
    return "ЛКТ";
  }
  if (normalized === "pritsepy_i_polupritsepy") {
    return "ПРИЦЕП";
  }
  if (normalized === "avtobusy") {
    return "АВТОБУС";
  }
  if (normalized === "mototehnika") {
    return "МОТОТЕХНИКА";
  }
  return "СПЕЦТЕХНИКА";
}

function mapReservationStatus(reservDate: unknown): {
  status: string;
  bookingStatus: string;
} {
  const hasReservation = normalizeText(reservDate).length > 0;
  if (hasReservation) {
    return {
      status: "Забронировано",
      bookingStatus: "Резерв",
    };
  }

  return {
    status: "В продаже",
    bookingStatus: "Свободен",
  };
}

function toWebsiteUrl(offerCode: string): string {
  return `${CARCADE_BASE_URL}${CARCADE_USED_PATH}/${offerCode}`;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchCarcadeTypes(options: ScriptOptions): Promise<CarcadeFilterType[]> {
  const payload = await fetchJsonWithTimeout<CarcadeFilterResponse>(
    CARCADE_FILTER_URL,
    {
      method: "GET",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "application/json, text/plain, */*",
      },
    },
    options.timeoutMs,
  );

  const rawTypes = Array.isArray(payload.filter?.types) ? payload.filter.types : [];
  return rawTypes.filter((item) => normalizeTypeCode(item.code).length > 0);
}

async function fetchCarcadePage(
  options: ScriptOptions,
  typeCode: string,
  page: number,
): Promise<CarcadeListResponse> {
  const normalizedTypeCode = normalizeTypeCode(typeCode);
  const fullPath = normalizedTypeCode
    ? `${CARCADE_USED_PATH}/${normalizedTypeCode}`
    : CARCADE_USED_PATH;
  const fullUrl = `${CARCADE_BASE_URL}${fullPath}`;

  return fetchJsonWithTimeout<CarcadeListResponse>(
    CARCADE_LIST_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        origin: CARCADE_BASE_URL,
        referer: fullUrl,
        "x-full-url": fullUrl,
      },
      body: JSON.stringify({
        fields: {
          type: normalizedTypeCode,
          page,
        },
      }),
    },
    options.timeoutMs,
  );
}

function parseCarcadeItem(item: CarcadeListItem, typeCode: string): ParsedCarcadeItem | null {
  const offerCodeRaw = normalizeText(String(item.id ?? ""));
  if (!offerCodeRaw) {
    return null;
  }

  const offerCode = offerCodeRaw;
  const brand = normalizeText(item.brand);
  if (!brand) {
    return null;
  }

  const model = normalizeText(item.model);
  const modification = model || brand;
  const { status, bookingStatus } = mapReservationStatus(item.reservdate);
  const pictureUrl = toAbsoluteUrl(normalizeText(item.picture));
  const year = parseYear(item.year);
  const mileageKm = parseMileageFromAttributes(item.attrs);
  const price = parseInteger(item.price);
  const storageAddress = normalizeText(item.city);
  const externalId = normalizeText(item.dl) || offerCode;

  return {
    offerCode,
    status,
    bookingStatus,
    brand,
    model,
    modification,
    vehicleType: mapTypeCodeToVehicleType(typeCode),
    year,
    mileageKm,
    price,
    storageAddress,
    websiteUrl: toWebsiteUrl(offerCode),
    mediaSource: pictureUrl,
    externalId,
  };
}

function toExportRow(item: ParsedCarcadeItem): ExportRow {
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

  XLSX.utils.book_append_sheet(workbook, worksheet, "carcade_catalog");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function collectCarcadeItems(
  options: ScriptOptions,
  onProgress?: (progress: CarcadeScrapeProgress) => void,
): Promise<ParsedCarcadeItem[]> {
  const types = await fetchCarcadeTypes(options);
  if (types.length === 0) {
    return [];
  }

  const itemsByOfferCode = new Map<string, ParsedCarcadeItem>();
  let processedPages = 0;
  let totalPlannedPages = 0;

  for (const type of types) {
    const typeCode = normalizeTypeCode(type.code);
    if (!typeCode) {
      continue;
    }

    const firstPagePayload = await fetchCarcadePage(options, typeCode, 1);
    const firstPageCount = Math.max(1, Number(firstPagePayload.pageCnt ?? 1));
    const targetPageCount = Math.max(1, Math.min(firstPageCount, options.pageLimit));
    totalPlannedPages += targetPageCount;

    for (let page = 1; page <= targetPageCount; page += 1) {
      const pagePayload =
        page === 1
          ? firstPagePayload
          : await fetchCarcadePage(options, typeCode, page);
      const items = Array.isArray(pagePayload.items) ? pagePayload.items : [];

      items.forEach((item) => {
        const parsed = parseCarcadeItem(item, typeCode);
        if (!parsed) {
          return;
        }
        if (!itemsByOfferCode.has(parsed.offerCode)) {
          itemsByOfferCode.set(parsed.offerCode, parsed);
        }
      });

      processedPages += 1;
      onProgress?.({
        stage: "listing",
        processed: processedPages,
        total: Math.max(totalPlannedPages, processedPages),
      });

      console.log("carcade_scrape_page_done", {
        typeCode,
        page,
        pageItems: items.length,
        totalUniqueItems: itemsByOfferCode.size,
        processedPages,
        totalPlannedPages,
      });

      if (options.maxItems !== null && itemsByOfferCode.size >= options.maxItems) {
        return Array.from(itemsByOfferCode.values()).slice(0, options.maxItems);
      }

      if (page < targetPageCount) {
        await sleep(options.delayMs);
      }
    }

    await sleep(options.delayMs);
  }

  const collected = Array.from(itemsByOfferCode.values());
  if (options.maxItems !== null && collected.length > options.maxItems) {
    return collected.slice(0, options.maxItems);
  }

  return collected;
}

export async function scrapeCarcadeUsedToWorkbook(
  options: CarcadeScrapeOptions = {},
  onProgress?: (progress: CarcadeScrapeProgress) => void,
): Promise<CarcadeScrapeResult> {
  const resolvedOptions = resolveCarcadeScrapeOptions(options);
  const items = await collectCarcadeItems(resolvedOptions, onProgress);
  const rows = items.map((item) => toExportRow(item));
  const fileBuffer = buildWorkbookBuffer(rows);

  return {
    itemsCount: items.length,
    withPrice: items.filter((item) => item.price !== null).length,
    withYear: items.filter((item) => item.year !== null).length,
    withMileage: items.filter((item) => item.mileageKm !== null).length,
    withMedia: items.filter((item) => item.mediaSource.length > 0).length,
    fileBuffer,
    outputPath: resolvedOptions.outputPath,
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  console.log("carcade_scrape_started", options);

  const result = await scrapeCarcadeUsedToWorkbook(options);
  mkdirSync(path.dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, result.fileBuffer);

  console.log("carcade_scrape_completed", {
    totalItems: result.itemsCount,
    withPrice: result.withPrice,
    withYear: result.withYear,
    withMileage: result.withMileage,
    withMedia: result.withMedia,
    outputPath: options.outputPath,
  });
}

if (require.main === module) {
  void main().catch((error) => {
    console.log("carcade_scrape_failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    process.exitCode = 1;
  });
}
