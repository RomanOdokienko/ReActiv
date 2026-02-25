export interface VehicleOffer {
  id: number;
  import_batch_id: string;
  offer_code: string;
  status: string;
  brand: string;
  model: string;
  modification: string;
  vehicle_type: string;
  year: number | null;
  mileage_km: number | null;
  key_count: number | null;
  pts_type: string;
  has_encumbrance: boolean | null;
  is_deregistered: boolean | null;
  responsible_person: string;
  storage_address: string;
  days_on_sale: number | null;
  price: number | null;
  yandex_disk_url: string;
  booking_status: string;
  external_id: string;
  crm_ref: string;
  website_url: string;
  title: string;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  status: "completed" | "completed_with_errors" | "failed";
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  created_at: string;
}

export interface ImportError {
  id: number;
  import_batch_id: string;
  row_number: number;
  field: string | null;
  message: string;
  created_at: string;
}

export const REQUIRED_IMPORT_FIELDS = [
  "offer_code",
  "status",
  "brand",
  "model",
  "modification",
  "vehicle_type",
  "year",
  "mileage_km",
  "key_count",
  "pts_type",
  "has_encumbrance",
  "is_deregistered",
  "responsible_person",
  "storage_address",
  "days_on_sale",
  "price",
  "yandex_disk_url",
  "booking_status",
  "external_id",
  "crm_ref",
  "website_url",
] as const;

export type CanonicalField = (typeof REQUIRED_IMPORT_FIELDS)[number];
