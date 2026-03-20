import { normalizeString } from "./normalize-string";

function normalizeSingleSeparator(cleaned: string, separator: "," | "."): string {
  const firstIndex = cleaned.indexOf(separator);
  const lastIndex = cleaned.lastIndexOf(separator);

  if (firstIndex !== lastIndex) {
    // Repeated separator is treated as thousands grouping.
    return cleaned.split(separator).join("");
  }

  const digitsAfter = cleaned.length - firstIndex - 1;
  // Single separator with three digits after it usually means thousands group (e.g. 7,400).
  if (digitsAfter === 3) {
    return cleaned.split(separator).join("");
  }

  return cleaned.replace(separator, ".");
}

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
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    cleaned = cleaned.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") {
      cleaned = cleaned.replace(",", ".");
    }
  } else if (cleaned.includes(",")) {
    cleaned = normalizeSingleSeparator(cleaned, ",");
  } else if (cleaned.includes(".")) {
    cleaned = normalizeSingleSeparator(cleaned, ".");
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}
