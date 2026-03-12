import { normalizeString } from "./normalize-string";

const CANONICAL_BRAND_ALIASES = new Map<string, string>([
  ["lixiang", "Li (Lixiang)"],
  ["li xiang", "Li (Lixiang)"],
  ["li (lixiang)", "Li (Lixiang)"],
]);

function toTitleCase(value: string): string {
  const lower = value.toLocaleLowerCase("ru-RU");
  const parts = lower.split(/(\s+|[-/])/g);

  return parts
    .map((part) => {
      if (!part || /^(?:\s+|[-/])$/.test(part)) {
        return part;
      }

      const [firstChar, ...restChars] = Array.from(part);
      if (!firstChar) {
        return part;
      }

      return firstChar.toLocaleUpperCase("ru-RU") + restChars.join("");
    })
    .join("");
}

export function normalizeBrand(rawValue: unknown): string | null {
  const normalized = normalizeString(rawValue);
  if (!normalized) {
    return null;
  }

  const aliasKey = normalized.toLocaleLowerCase("ru-RU");
  const canonicalAlias = CANONICAL_BRAND_ALIASES.get(aliasKey);
  if (canonicalAlias) {
    return canonicalAlias;
  }

  return toTitleCase(normalized);
}
