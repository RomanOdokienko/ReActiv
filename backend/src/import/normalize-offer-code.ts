import { normalizeString } from "./normalize-string";

export function normalizeOfferCode(rawValue: unknown): string | null {
  const normalized = normalizeString(rawValue).replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized) && normalized.length < 6) {
    return normalized.padStart(6, "0");
  }

  return normalized;
}

export function normalizeOfferCodePreserve(rawValue: unknown): string | null {
  const normalized = normalizeString(rawValue);
  return normalized || null;
}
