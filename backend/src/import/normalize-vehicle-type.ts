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
    return "Автобусы";
  }

  if (includesAny(lower, ["грузов"])) {
    return "Грузовая техника";
  }

  if (includesAny(lower, ["легков"])) {
    return "Легковая техника";
  }

  if (includesAny(lower, ["лкт", "легкий коммерчес"])) {
    return "Легкий коммерческий транспорт";
  }

  if (includesAny(lower, ["мото"])) {
    return "Мототехника";
  }

  if (includesAny(lower, ["прицеп"])) {
    return "Прицепная техника";
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
    return "Спецтехника";
  }

  return normalized;
}

