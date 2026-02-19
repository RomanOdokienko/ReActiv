import { normalizeString } from "./normalize-string";

const TRUE_VALUES = new Set(["да", "yes", "true", "1"]);
const FALSE_VALUES = new Set(["нет", "no", "false", "0"]);

export function parseBoolean(rawValue: unknown): boolean | null {
  const normalized = normalizeString(rawValue).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return null;
}
