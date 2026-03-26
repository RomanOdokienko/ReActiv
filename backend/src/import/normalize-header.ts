export function normalizeHeader(rawHeader: unknown): string {
  const text = String(rawHeader ?? "");

  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ё]/g, "е")
    .replace(/["'`«»]/g, "")
    .replace(/[:;,.()[\]{}]/g, " ")
    .replace(/[/\\|]+/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
