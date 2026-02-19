import type { CanonicalField } from "../domain/types";
import type { ColumnMapResult } from "./resolve-column-map";
import { buildTitle } from "./build-title";
import { normalizeString } from "./normalize-string";
import { normalizeUrl } from "./normalize-url";
import { parseBoolean } from "./parse-boolean";
import { parseInteger } from "./parse-integer";
import { parsePrice } from "./parse-price";

export interface NormalizedVehicleOfferRow {
  offer_code: string | null;
  status: string | null;
  brand: string | null;
  model: string | null;
  modification: string | null;
  vehicle_type: string | null;
  year: number | null;
  mileage_km: number | null;
  key_count: number | string | null;
  pts_type: string | null;
  has_encumbrance: boolean | string | null;
  is_deregistered: boolean | string | null;
  responsible_person: string | null;
  storage_address: string | null;
  days_on_sale: number | null;
  price: number | null;
  yandex_disk_url: string | null;
  booking_status: string | null;
  external_id: string | null;
  crm_ref: string | null;
  website_url: string | null;
  title: string;
}

function getValue(
  row: unknown[],
  fieldToColumnIndex: ColumnMapResult["fieldToColumnIndex"],
  field: CanonicalField,
): unknown {
  const columnIndex = fieldToColumnIndex[field];
  return columnIndex === undefined ? null : row[columnIndex];
}

export function normalizeVehicleOfferRow(
  row: unknown[],
  fieldToColumnIndex: ColumnMapResult["fieldToColumnIndex"],
): NormalizedVehicleOfferRow {
  const offerCode = normalizeString(getValue(row, fieldToColumnIndex, "offer_code")) || null;
  const brand = normalizeString(getValue(row, fieldToColumnIndex, "brand")) || null;
  const model = normalizeString(getValue(row, fieldToColumnIndex, "model")) || null;
  const modification =
    normalizeString(getValue(row, fieldToColumnIndex, "modification")) || null;

  const keyCountRaw = normalizeString(getValue(row, fieldToColumnIndex, "key_count")) || null;
  const hasEncumbranceRaw =
    normalizeString(getValue(row, fieldToColumnIndex, "has_encumbrance")) || null;
  const isDeregisteredRaw =
    normalizeString(getValue(row, fieldToColumnIndex, "is_deregistered")) || null;

  const parsedKeyCount = parseInteger(keyCountRaw);
  const parsedHasEncumbrance = parseBoolean(hasEncumbranceRaw);
  const parsedIsDeregistered = parseBoolean(isDeregisteredRaw);

  return {
    offer_code: offerCode,
    status: normalizeString(getValue(row, fieldToColumnIndex, "status")) || null,
    brand,
    model,
    modification,
    vehicle_type: normalizeString(getValue(row, fieldToColumnIndex, "vehicle_type")) || null,
    year: parseInteger(getValue(row, fieldToColumnIndex, "year")),
    mileage_km: parseInteger(getValue(row, fieldToColumnIndex, "mileage_km")),
    key_count: parsedKeyCount ?? keyCountRaw,
    pts_type: normalizeString(getValue(row, fieldToColumnIndex, "pts_type")) || null,
    has_encumbrance: parsedHasEncumbrance ?? hasEncumbranceRaw,
    is_deregistered: parsedIsDeregistered ?? isDeregisteredRaw,
    responsible_person:
      normalizeString(getValue(row, fieldToColumnIndex, "responsible_person")) || null,
    storage_address:
      normalizeString(getValue(row, fieldToColumnIndex, "storage_address")) || null,
    days_on_sale: parseInteger(getValue(row, fieldToColumnIndex, "days_on_sale")),
    price: parsePrice(getValue(row, fieldToColumnIndex, "price")),
    yandex_disk_url: normalizeUrl(getValue(row, fieldToColumnIndex, "yandex_disk_url")),
    booking_status: normalizeString(getValue(row, fieldToColumnIndex, "booking_status")) || null,
    external_id: normalizeString(getValue(row, fieldToColumnIndex, "external_id")) || null,
    crm_ref: normalizeString(getValue(row, fieldToColumnIndex, "crm_ref")) || null,
    website_url: normalizeUrl(getValue(row, fieldToColumnIndex, "website_url")),
    title: buildTitle(brand, model, modification, offerCode),
  };
}
