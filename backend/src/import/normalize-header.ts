export function normalizeHeader(rawHeader: unknown): string {
  const text = String(rawHeader ?? "");

  const normalized = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ё]/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return normalized;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  const mergedTokens: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    if (current.length !== 1) {
      mergedTokens.push(current);
      continue;
    }

    let compact = current;
    let lookahead = index + 1;
    while (lookahead < tokens.length && tokens[lookahead].length === 1) {
      compact += tokens[lookahead];
      lookahead += 1;
    }

    mergedTokens.push(compact);
    index = lookahead - 1;
  }

  return mergedTokens.join(" ");
}
