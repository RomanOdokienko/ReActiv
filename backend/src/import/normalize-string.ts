export function normalizeString(rawValue: unknown): string {
  return String(rawValue ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}
