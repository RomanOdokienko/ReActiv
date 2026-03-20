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

interface VehicleTypeNormalizationContext {
  tenantId?: string;
  statusRaw?: unknown;
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function resolveSovcomVehicleTypeBySign(rawStatus: unknown): string | null {
  const status = normalizeString(rawStatus).toLowerCase();
  if (!status) {
    return null;
  }

  if (includesAny(status, ["автобус"])) {
    return "АВТОБУС";
  }

  if (includesAny(status, ["мото", "квадро", "снегоход"])) {
    return "МОТОТЕХНИКА";
  }

  if (
    includesAny(status, [
      "прицеп",
      "полуприцеп",
      "штор",
      "зерновоз",
      "цистерн",
      "контейнеровоз",
      "трал",
      "реф",
      "изотерм",
    ])
  ) {
    return "ПРИЦЕП";
  }

  if (
    includesAny(status, [
      "экскаватор",
      "погрузчик",
      "бульдозер",
      "грейдер",
      "каток",
      "автокран",
      "кму",
      "манипулятор",
      "самоход",
      "трактор",
    ])
  ) {
    return VEHICLE_TYPE_FALLBACK;
  }

  if (includesAny(status, ["легков", "пикап"])) {
    return "ЛЕГКОВОЙ";
  }

  if (
    includesAny(status, [
      "самосвал",
      "тягач",
      "грузов",
      "бортов",
      "фургон",
      "евротент",
    ])
  ) {
    return "ГРУЗОВОЙ";
  }

  return null;
}

function resolveSovcomVehicleTypeMeta(
  rawVehicleType: unknown,
  rawStatus: unknown,
): VehicleTypeNormalizationMeta {
  const rawNormalized = normalizeString(rawVehicleType);
  const normalizedUpper = rawNormalized.toUpperCase();
  const compactUpper = normalizedUpper.replace(/\s+/g, "");
  const bySign = resolveSovcomVehicleTypeBySign(rawStatus);

  if (compactUpper === "ЛА" || compactUpper === "LA") {
    return { normalized: "ЛЕГКОВОЙ", rawNormalized, usedFallback: false };
  }

  if (compactUpper === "ЛКТ" || compactUpper === "LKT") {
    return { normalized: "ЛКТ", rawNormalized, usedFallback: false };
  }

  if (compactUpper === "ПРИЦЕП") {
    return { normalized: "ПРИЦЕП", rawNormalized, usedFallback: false };
  }

  if (compactUpper === "СТ" || compactUpper === "ST") {
    return { normalized: VEHICLE_TYPE_FALLBACK, rawNormalized, usedFallback: false };
  }

  if (compactUpper === "КТ" || compactUpper === "KT" || !compactUpper) {
    if (bySign) {
      return { normalized: bySign, rawNormalized, usedFallback: false };
    }

    return { normalized: "ГРУЗОВОЙ", rawNormalized, usedFallback: false };
  }

  const generic = resolveVehicleTypeMeta(rawVehicleType);
  if (generic.normalized === VEHICLE_TYPE_FALLBACK && bySign) {
    return {
      normalized: bySign,
      rawNormalized: generic.rawNormalized,
      usedFallback: false,
    };
  }

  return generic;
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

export function normalizeVehicleTypeWithMeta(
  rawValue: unknown,
  context: VehicleTypeNormalizationContext = {},
): VehicleTypeNormalizationMeta {
  if (context.tenantId === "sovcombank") {
    return resolveSovcomVehicleTypeMeta(rawValue, context.statusRaw);
  }

  return resolveVehicleTypeMeta(rawValue);
}

export function normalizeVehicleType(rawValue: unknown): string | null {
  return resolveVehicleTypeMeta(rawValue).normalized;
}
