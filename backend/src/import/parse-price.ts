import { normalizeString } from "./normalize-string";

export function parsePrice(rawValue: unknown): number | null {
  const normalized = normalizeString(rawValue);
  if (!normalized) {
    return null;
  }

  let cleaned = normalized.replace(/\s+/g, "");
  cleaned = cleaned.replace(/[^\d,.-]/g, "");

  if (!cleaned) {
    return null;
  }

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/,/g, ".");
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}
