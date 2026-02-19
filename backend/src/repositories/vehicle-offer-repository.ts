import { db } from "../db/connection";
import type { NormalizedVehicleOfferRow } from "../import/normalize-row";

function toDbText(value: string | null): string {
  return value ?? "";
}

function toDbBooleanOrRaw(value: boolean | string | null): number | string {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function toDbNumberOrRaw(value: number | string | null): number | string {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  return "";
}

export function insertVehicleOffer(
  importBatchId: string,
  row: NormalizedVehicleOfferRow,
): void {
  db.prepare(
    `
      INSERT INTO vehicle_offers (
        import_batch_id,
        offer_code,
        status,
        brand,
        model,
        modification,
        vehicle_type,
        year,
        mileage_km,
        key_count,
        pts_type,
        has_encumbrance,
        is_deregistered,
        responsible_person,
        storage_address,
        days_on_sale,
        price,
        yandex_disk_url,
        booking_status,
        external_id,
        crm_ref,
        website_url,
        title
      ) VALUES (
        @import_batch_id,
        @offer_code,
        @status,
        @brand,
        @model,
        @modification,
        @vehicle_type,
        @year,
        @mileage_km,
        @key_count,
        @pts_type,
        @has_encumbrance,
        @is_deregistered,
        @responsible_person,
        @storage_address,
        @days_on_sale,
        @price,
        @yandex_disk_url,
        @booking_status,
        @external_id,
        @crm_ref,
        @website_url,
        @title
      )
    `,
  ).run({
    import_batch_id: importBatchId,
    offer_code: toDbText(row.offer_code),
    status: toDbText(row.status),
    brand: toDbText(row.brand),
    model: toDbText(row.model),
    modification: toDbText(row.modification),
    vehicle_type: toDbText(row.vehicle_type),
    year: row.year,
    mileage_km: row.mileage_km,
    key_count: toDbNumberOrRaw(row.key_count),
    pts_type: toDbText(row.pts_type),
    has_encumbrance: toDbBooleanOrRaw(row.has_encumbrance),
    is_deregistered: toDbBooleanOrRaw(row.is_deregistered),
    responsible_person: toDbText(row.responsible_person),
    storage_address: toDbText(row.storage_address),
    days_on_sale: row.days_on_sale,
    price: row.price,
    yandex_disk_url: toDbText(row.yandex_disk_url),
    booking_status: toDbText(row.booking_status),
    external_id: toDbText(row.external_id),
    crm_ref: toDbText(row.crm_ref),
    website_url: toDbText(row.website_url),
    title: toDbText(row.title),
  });
}
