export function normalizeHeader(rawHeader: unknown): string {
  const text = String(rawHeader ?? "");

  return text
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replaceAll(":", "")
    .replace(/\s+/g, " ");
}
