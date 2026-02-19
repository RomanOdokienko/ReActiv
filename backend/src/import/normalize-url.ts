import { normalizeString } from "./normalize-string";

export function normalizeUrl(rawValue: unknown): string | null {
  const normalized = normalizeString(rawValue);
  if (!normalized) {
    return null;
  }

  const withScheme =
    normalized.startsWith("http://") || normalized.startsWith("https://")
      ? normalized
      : `https://${normalized}`;

  try {
    const url = new URL(withScheme);
    return url.toString();
  } catch {
    return normalized;
  }
}
