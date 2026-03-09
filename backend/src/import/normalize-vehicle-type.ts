import { normalizeString } from "./normalize-string";

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

export function normalizeVehicleType(rawValue: unknown): string | null {
  const normalized = normalizeString(rawValue);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  if (includesAny(lower, ["автобус"])) {
    return "АВТОБУС";
  }

  if (includesAny(lower, ["грузов"])) {
    return "ГРУЗОВОЙ";
  }

  if (includesAny(lower, ["легков"])) {
    return "ЛЕГКОВОЙ";
  }

  if (includesAny(lower, ["лкт", "легкий коммерчес"])) {
    return "ЛКТ";
  }

  if (includesAny(lower, ["мото"])) {
    return "МОТОТЕХНИКА";
  }

  if (includesAny(lower, ["прицеп"])) {
    return "ПРИЦЕП";
  }

  if (
    includesAny(lower, [
      "спец",
      "самоход",
      "трактор",
      "экскаватор",
      "оборудован",
      "маломер",
      "суд",
    ])
  ) {
    return "СПЕЦТЕХНИКА";
  }

  return normalized.toUpperCase();
}
