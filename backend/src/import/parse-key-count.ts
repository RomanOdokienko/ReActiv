import { normalizeString } from "./normalize-string";

export function parseKeyCount(rawValue: unknown): number | null {
  const normalized = normalizeString(rawValue).toLowerCase();
  if (!normalized) {
    return null;
  }

  const compact = normalized.replace(/\s+/g, "");

  if (compact === "нетключей") {
    return 0;
  }

  if (compact === "полныйкомплект") {
    return null;
  }

  const leadingDigitMatch = compact.match(/^(\d+)/);
  if (leadingDigitMatch) {
    const parsed = Number.parseInt(leadingDigitMatch[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}
