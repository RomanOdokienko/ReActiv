import { db } from "../db/connection";
import type { CatalogQuery } from "../catalog/catalog-query";

interface VehicleOfferDbRow {
  id: number;
  import_batch_id: string;
  offer_code: string;
  status: string;
  brand: string;
  model: string;
  modification: string;
  vehicle_type: string;
  year: number;
  mileage_km: number;
  key_count: number;
  pts_type: string;
  has_encumbrance: number;
  is_deregistered: number;
  responsible_person: string;
  storage_address: string;
  days_on_sale: number;
  price: number;
  yandex_disk_url: string;
  booking_status: string;
  external_id: string;
  crm_ref: string;
  website_url: string;
  title: string;
  created_at: string;
}

export interface CatalogItem {
  id: number;
  importBatchId: string;
  offerCode: string;
  status: string;
  brand: string;
  model: string;
  modification: string;
  vehicleType: string;
  year: number;
  mileageKm: number;
  keyCount: number;
  ptsType: string;
  hasEncumbrance: boolean;
  isDeregistered: boolean;
  responsiblePerson: string;
  storageAddress: string;
  daysOnSale: number;
  price: number;
  yandexDiskUrl: string;
  bookingStatus: string;
  externalId: string;
  crmRef: string;
  websiteUrl: string;
  title: string;
  createdAt: string;
}

function mapDbRow(row: VehicleOfferDbRow): CatalogItem {
  return {
    id: row.id,
    importBatchId: row.import_batch_id,
    offerCode: row.offer_code,
    status: row.status,
    brand: row.brand,
    model: row.model,
    modification: row.modification,
    vehicleType: row.vehicle_type,
    year: row.year,
    mileageKm: row.mileage_km,
    keyCount: row.key_count,
    ptsType: row.pts_type,
    hasEncumbrance: row.has_encumbrance === 1,
    isDeregistered: row.is_deregistered === 1,
    responsiblePerson: row.responsible_person,
    storageAddress: row.storage_address,
    daysOnSale: row.days_on_sale,
    price: row.price,
    yandexDiskUrl: row.yandex_disk_url,
    bookingStatus: row.booking_status,
    externalId: row.external_id,
    crmRef: row.crm_ref,
    websiteUrl: row.website_url,
    title: row.title,
    createdAt: row.created_at,
  };
}

function addInFilter(
  clauses: string[],
  params: unknown[],
  column: string,
  values?: string[] | number[],
): void {
  if (!values || values.length === 0) {
    return;
  }

  const placeholders = values.map(() => "?").join(", ");
  clauses.push(`${column} IN (${placeholders})`);
  params.push(...values);
}

function addLikeAnyFilter(
  clauses: string[],
  params: unknown[],
  column: string,
  values?: string[],
): void {
  if (!values || values.length === 0) {
    return;
  }

  const likeClauses = values.map(() => `${column} LIKE ?`).join(" OR ");
  clauses.push(`(${likeClauses})`);
  values.forEach((value) => {
    params.push(`%${value}%`);
  });
}

function normalizeRegionLabel(value: string): string {
  return value
    .replace(/^рф\s*,\s*/i, "")
    .replace(/^россия\s*,\s*/i, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/респ\.?/gi, "Республика")
    .replace(/обл\.?/gi, "область")
    .replace(/\/Якутия\//gi, "(Якутия)")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;]+$/g, "");
}

function canonicalizeRegionLabel(value: string): string {
  const normalized = normalizeRegionLabel(value);
  const lower = normalized.toLowerCase();

  if (lower.includes("ханты-мансий")) {
    return "Ханты-Мансийский автономный округ - Югра";
  }
  if (lower.includes("ямало-ненец")) {
    return "Ямало-Ненецкий АО";
  }
  if (lower.includes("саха") && lower.includes("якут")) {
    return "Республика Саха (Якутия)";
  }
  if (lower.includes("татарстан")) {
    return "Республика Татарстан";
  }
  if (lower.includes("бурят")) {
    return "Республика Бурятия";
  }
  if (lower.includes("башкортостан")) {
    return "Республика Башкортостан";
  }
  if (lower.includes("коми")) {
    return "Республика Коми";
  }
  if (lower.includes("мордов")) {
    return "Республика Мордовия";
  }
  if (lower.includes("хакаси")) {
    return "Республика Хакасия";
  }
  if (lower.includes("удмурт")) {
    return "Удмуртская Республика";
  }
  if (lower.includes("чуваш")) {
    return "Чувашская Республика";
  }
  if (lower.includes("кемеровск") && lower.includes("кузбасс")) {
    return "Кемеровская область - Кузбасс";
  }
  if (lower.includes("санкт-петербург")) {
    return "Санкт-Петербург";
  }
  if (lower.includes("севастополь")) {
    return "Севастополь";
  }
  if (lower === "москва") {
    return "Москва";
  }

  return normalized;
}

function extractRegionFromAddress(address: string): string | null {
  const normalized = address.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const withoutPostalIndex = normalized.replace(/^\d{5,6}(?:\s*,\s*|\s+)/, "");
  const parts = withoutPostalIndex
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const regionPart = parts.find((part) =>
    /(область|обл\.?|край|республика|респ\.?|автономный округ|автономная область|\bАО\b|кузбасс|чувашия)/i.test(
      part,
    ),
  );

  if (regionPart) {
    const truncatedRegion = regionPart.split(
      /\s+(?=(?:район|р-н|улус|г\.?|город|пгт|посел(?:ок|ение)?|село|деревня|тер|мкр|месторожд))/i,
    )[0];
    const normalizedRegion = canonicalizeRegionLabel(
      truncatedRegion.replace(/\s+\bАО\b$/i, ""),
    );
    if (normalizedRegion) {
      return normalizedRegion;
    }
  }

  const federalCityPart = parts.find((part) =>
    /^(город|г\.?)\s*(москва|санкт-петербург|севастополь)\b/i.test(part),
  );
  if (federalCityPart) {
    const cityName = federalCityPart.replace(/^(город|г\.?)\s*/i, "").trim();
    return cityName || null;
  }
  return null;
}

function buildWhere(filters: CatalogQuery): { whereClause: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  addInFilter(clauses, params, "offer_code", filters.offerCode);
  addInFilter(clauses, params, "status", filters.status);
  addLikeAnyFilter(clauses, params, "storage_address", filters.city);
  addInFilter(clauses, params, "brand", filters.brand);
  addInFilter(clauses, params, "model", filters.model);
  addInFilter(clauses, params, "modification", filters.modification);
  addInFilter(clauses, params, "vehicle_type", filters.vehicleType);
  addInFilter(clauses, params, "pts_type", filters.ptsType);
  addInFilter(
    clauses,
    params,
    "has_encumbrance",
    filters.hasEncumbrance?.map((value) => (value ? 1 : 0)),
  );
  addInFilter(
    clauses,
    params,
    "is_deregistered",
    filters.isDeregistered?.map((value) => (value ? 1 : 0)),
  );
  addInFilter(clauses, params, "responsible_person", filters.responsiblePerson);
  addInFilter(clauses, params, "storage_address", filters.storageAddress);
  addInFilter(clauses, params, "booking_status", filters.bookingStatus);
  addInFilter(clauses, params, "external_id", filters.externalId);
  addInFilter(clauses, params, "crm_ref", filters.crmRef);
  addInFilter(clauses, params, "website_url", filters.websiteUrl);
  addInFilter(clauses, params, "yandex_disk_url", filters.yandexDiskUrl);

  if (filters.priceMin !== undefined) {
    clauses.push("price >= ?");
    params.push(filters.priceMin);
  }
  if (filters.priceMax !== undefined) {
    clauses.push("price <= ?");
    params.push(filters.priceMax);
  }
  if (filters.yearMin !== undefined) {
    clauses.push("year >= ?");
    params.push(filters.yearMin);
  }
  if (filters.yearMax !== undefined) {
    clauses.push("year <= ?");
    params.push(filters.yearMax);
  }
  if (filters.mileageMin !== undefined) {
    clauses.push("mileage_km >= ?");
    params.push(filters.mileageMin);
  }
  if (filters.mileageMax !== undefined) {
    clauses.push("mileage_km <= ?");
    params.push(filters.mileageMax);
  }
  if (filters.keyCountMin !== undefined) {
    clauses.push("key_count >= ?");
    params.push(filters.keyCountMin);
  }
  if (filters.keyCountMax !== undefined) {
    clauses.push("key_count <= ?");
    params.push(filters.keyCountMax);
  }
  if (filters.daysOnSaleMin !== undefined) {
    clauses.push("days_on_sale >= ?");
    params.push(filters.daysOnSaleMin);
  }
  if (filters.daysOnSaleMax !== undefined) {
    clauses.push("days_on_sale <= ?");
    params.push(filters.daysOnSaleMax);
  }
  if (filters.search) {
    clauses.push(
      `
        (
          offer_code LIKE ?
          OR status LIKE ?
          OR brand LIKE ?
          OR model LIKE ?
          OR modification LIKE ?
          OR vehicle_type LIKE ?
          OR pts_type LIKE ?
          OR responsible_person LIKE ?
          OR storage_address LIKE ?
          OR booking_status LIKE ?
          OR external_id LIKE ?
          OR crm_ref LIKE ?
          OR website_url LIKE ?
          OR yandex_disk_url LIKE ?
          OR title LIKE ?
        )
      `,
    );
    const searchLike = `%${filters.search}%`;
    params.push(
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
    );
  }

  if (clauses.length === 0) {
    return { whereClause: "", params };
  }

  return {
    whereClause: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

export function searchCatalogItems(filters: CatalogQuery): {
  items: CatalogItem[];
  total: number;
} {
  const { whereClause, params } = buildWhere(filters);

  const totalRow = db
    .prepare(`SELECT COUNT(*) as total FROM vehicle_offers ${whereClause}`)
    .get(...params) as { total: number };

  const limit = filters.pageSize;
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = db
    .prepare(
      `
        SELECT *
        FROM vehicle_offers
        ${whereClause}
        ORDER BY
          CASE
            WHEN TRIM(COALESCE(yandex_disk_url, '')) = '' THEN 0
            WHEN lower(yandex_disk_url) LIKE '%disk.yandex.%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%yadi.sk%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%downloader.disk.yandex.%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%.jpg%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%.jpeg%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%.png%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%.webp%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%.gif%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%.bmp%' THEN 1
            WHEN lower(yandex_disk_url) LIKE '%.svg%' THEN 1
            ELSE 0
          END DESC,
          ${filters.sortBy} ${filters.sortDir.toUpperCase()}
        LIMIT ?
        OFFSET ?
      `,
    )
    .all(...params, limit, offset) as VehicleOfferDbRow[];

  return {
    items: rows.map(mapDbRow),
    total: totalRow.total,
  };
}

export function findCatalogItemById(id: number): CatalogItem | null {
  const row = db
    .prepare(
      `
        SELECT *
        FROM vehicle_offers
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id) as VehicleOfferDbRow | undefined;

  if (!row) {
    return null;
  }

  return mapDbRow(row);
}

export function getCatalogFiltersMetadata(): Record<string, unknown> {
  const distinct = (column: string): string[] =>
    (
      db
        .prepare(`SELECT DISTINCT ${column} AS value FROM vehicle_offers ORDER BY ${column} ASC`)
        .all() as Array<{ value: string }>
    )
      .map((row) => row.value)
      .filter((value) => value !== null && value !== undefined && value !== "");

  const boolDistinct = (column: string): boolean[] =>
    (
      db
        .prepare(`SELECT DISTINCT ${column} AS value FROM vehicle_offers ORDER BY ${column} ASC`)
        .all() as Array<{ value: number }>
    ).map((row) => row.value === 1);

  const rangeRow = db
    .prepare(
      `
      SELECT
        MIN(price) AS priceMin,
        MAX(price) AS priceMax,
        MIN(year) AS yearMin,
        MAX(year) AS yearMax,
        MIN(mileage_km) AS mileageMin,
        MAX(mileage_km) AS mileageMax,
        MIN(key_count) AS keyCountMin,
        MAX(key_count) AS keyCountMax,
        MIN(days_on_sale) AS daysOnSaleMin,
        MAX(days_on_sale) AS daysOnSaleMax
      FROM vehicle_offers
      `,
    )
    .get() as Record<string, number | null>;

  const modelsByBrandRows = db
    .prepare(
      `
        SELECT brand, model
        FROM vehicle_offers
        WHERE brand != '' AND model != ''
        GROUP BY brand, model
        ORDER BY brand ASC, model ASC
      `,
    )
    .all() as Array<{ brand: string; model: string }>;

  const modelsByBrand = modelsByBrandRows.reduce<Record<string, string[]>>(
    (accumulator, row) => {
      if (!accumulator[row.brand]) {
        accumulator[row.brand] = [];
      }
      accumulator[row.brand].push(row.model);
      return accumulator;
    },
    {},
  );

  const citySet = new Set<string>();
  const storageAddresses = distinct("storage_address");
  storageAddresses.forEach((address) => {
    const region = extractRegionFromAddress(address);
    if (region) {
      citySet.add(region);
    }
  });
  const city = Array.from(citySet).sort((a, b) =>
    a.localeCompare(b, "ru", { sensitivity: "base" }),
  );

  return {
    offerCode: distinct("offer_code"),
    status: distinct("status"),
    city,
    brand: distinct("brand"),
    model: distinct("model"),
    modification: distinct("modification"),
    vehicleType: distinct("vehicle_type"),
    ptsType: distinct("pts_type"),
    hasEncumbrance: boolDistinct("has_encumbrance"),
    isDeregistered: boolDistinct("is_deregistered"),
    responsiblePerson: distinct("responsible_person"),
    storageAddress: distinct("storage_address"),
    bookingStatus: distinct("booking_status"),
    externalId: distinct("external_id"),
    crmRef: distinct("crm_ref"),
    websiteUrl: distinct("website_url"),
    yandexDiskUrl: distinct("yandex_disk_url"),
    modelsByBrand,
    ...rangeRow,
  };
}
