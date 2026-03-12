import { normalizeString } from "./normalize-string";

export function normalizeBrand(rawValue: unknown): string | null {
  const normalized = normalizeString(rawValue);
  if (!normalized) {
    return null;
  }

  return normalized.toLocaleUpperCase("ru-RU");
}
