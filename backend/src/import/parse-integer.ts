import { normalizeString } from "./normalize-string";

export function parseInteger(rawValue: unknown): number | null {
  const normalized = normalizeString(rawValue).replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  if (!/^-?\d+$/.test(normalized)) {
    const numericGroups = normalized.match(/-?\d+/g) ?? [];
    if (numericGroups.length !== 1) {
      return null;
    }

    const fallbackParsed = Number.parseInt(numericGroups[0], 10);
    return Number.isNaN(fallbackParsed) ? null : fallbackParsed;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
