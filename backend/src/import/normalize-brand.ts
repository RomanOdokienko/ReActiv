import { normalizeString } from "./normalize-string";

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

  return toTitleCase(normalized);
}
