import { normalizeString } from "./normalize-string";

const VEHICLE_TYPE_FALLBACK = "СПЕЦТЕХНИКА";
const CANONICAL_TYPES = new Set([
  "АВТОБУС",
  "ГРУЗОВОЙ",
  "ЛЕГКОВОЙ",
  "ЛКТ",
  "МОТОТЕХНИКА",
  "ПРИЦЕП",
  VEHICLE_TYPE_FALLBACK,
]);

export interface VehicleTypeNormalizationMeta {
  normalized: string | null;
  rawNormalized: string | null;
  usedFallback: boolean;
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function resolveVehicleTypeMeta(rawValue: unknown): VehicleTypeNormalizationMeta {
  const rawNormalized = normalizeString(rawValue);
  if (!rawNormalized) {
    return {
      normalized: null,
      rawNormalized: null,
      usedFallback: false,
    };
  }

  const normalizedUpper = rawNormalized.toUpperCase();
  if (CANONICAL_TYPES.has(normalizedUpper)) {
    return {
      normalized: normalizedUpper,
      rawNormalized,
      usedFallback: false,
    };
  }

  const lower = rawNormalized.toLowerCase();

  if (includesAny(lower, ["автобус"])) {
    return { normalized: "АВТОБУС", rawNormalized, usedFallback: false };
  }

  if (includesAny(lower, ["грузов"])) {
    return { normalized: "ГРУЗОВОЙ", rawNormalized, usedFallback: false };
  }

  if (includesAny(lower, ["легков"])) {
    return { normalized: "ЛЕГКОВОЙ", rawNormalized, usedFallback: false };
  }

  if (includesAny(lower, ["лкт", "легкий коммерчес"])) {
    return { normalized: "ЛКТ", rawNormalized, usedFallback: false };
  }

  if (includesAny(lower, ["мото"])) {
    return { normalized: "МОТОТЕХНИКА", rawNormalized, usedFallback: false };
  }

  if (includesAny(lower, ["прицеп"])) {
    return { normalized: "ПРИЦЕП", rawNormalized, usedFallback: false };
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
    return { normalized: VEHICLE_TYPE_FALLBACK, rawNormalized, usedFallback: false };
  }

  return {
    normalized: VEHICLE_TYPE_FALLBACK,
    rawNormalized,
    usedFallback: true,
  };
}

export function normalizeVehicleTypeWithMeta(rawValue: unknown): VehicleTypeNormalizationMeta {
  return resolveVehicleTypeMeta(rawValue);
}

export function normalizeVehicleType(rawValue: unknown): string | null {
  return resolveVehicleTypeMeta(rawValue).normalized;
}
