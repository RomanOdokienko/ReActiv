import type { CanonicalField } from "../domain/types";
import type { NormalizedVehicleOfferRow } from "./normalize-row";

export interface RowValidationError {
  field: CanonicalField;
  message: string;
}

function pushIfEmpty(
  errors: RowValidationError[],
  field: CanonicalField,
  value: string | null,
): void {
  if (!value) {
    errors.push({ field, message: "Required field is empty" });
  }
}

export function validateNormalizedRow(
  row: NormalizedVehicleOfferRow,
): RowValidationError[] {
  const errors: RowValidationError[] = [];

  pushIfEmpty(errors, "offer_code", row.offer_code);

  if (row.year === null || row.year < 1950 || row.year > 2100) {
    errors.push({ field: "year", message: "Invalid year value" });
  }

  if (row.mileage_km === null) {
    errors.push({ field: "mileage_km", message: "Invalid mileage value" });
  }

  if (row.key_count === null) {
    errors.push({ field: "key_count", message: "Invalid key_count value" });
  }

  if (row.has_encumbrance === null) {
    errors.push({
      field: "has_encumbrance",
      message: "Invalid has_encumbrance value",
    });
  }

  if (row.is_deregistered === null) {
    errors.push({
      field: "is_deregistered",
      message: "Invalid is_deregistered value",
    });
  }

  if (row.days_on_sale === null) {
    errors.push({ field: "days_on_sale", message: "Invalid days_on_sale value" });
  }

  if (row.price === null) {
    errors.push({ field: "price", message: "Invalid price value" });
  }

  return errors;
}
