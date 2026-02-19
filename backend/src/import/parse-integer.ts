import { normalizeString } from "./normalize-string";

export function parseInteger(rawValue: unknown): number | null {
  const normalized = normalizeString(rawValue).replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
