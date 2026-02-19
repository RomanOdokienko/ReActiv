import { normalizeString } from "./normalize-string";

export function buildTitle(
  brand: string | null,
  model: string | null,
  modification: string | null,
  offerCode: string | null,
): string {
  const title = [brand, model, modification]
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .join(" ");

  if (title) {
    return title;
  }

  return normalizeString(offerCode);
}
