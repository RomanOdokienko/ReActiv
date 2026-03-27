import type { CanonicalField } from "../domain/types";
import { normalizeOfferCode, normalizeOfferCodePreserve } from "./normalize-offer-code";

export type ImportTenantId = "gpb" | "reso" | "alpha" | "sovcombank";

type HeaderAliases = Record<CanonicalField, string[]>;

export interface ImportTenantProfile {
  id: ImportTenantId;
  label: string;
  headerAliases: HeaderAliases;
  offerCodeNormalizer: (rawValue: unknown) => string | null;
}

const RESO_HEADER_OVERRIDES: Partial<HeaderAliases> = {
  offer_code: ["VIN / Зав.№"],
  status: ["Статус"],
  brand: ["Предмет лизинга.Марка"],
  model: ["Предмет лизинга.Модель"],
  modification: ["Предмет лизинга.Тип предмета лизинга"],
  vehicle_type: ["Предмет лизинга.Тип предмета лизинга"],
  year: ["Год выпуска"],
  mileage_km: ["Пробег (м/ч)"],
  is_deregistered: ["Дата снятия с учета"],
  responsible_person: ["Менеджер продающий"],
  storage_address: ["Местонахождение"],
  days_on_sale: ["Дней в продаже"],
  price: ["Утвержденная цена"],
  booking_status: ["Статус резерва"],
  external_id: ["№ п/п"],
  has_encumbrance: ["Арест"],
};

const GPB_HEADER_ADDITIONS: Partial<HeaderAliases> = {
  responsible_person: [
    "Ответственный за ТС",
    "Ответсвенный за ТС",
    "Ответственный за TC",
    "Ответсвенный за TC",
  ],
  days_on_sale: [
    "Количество дней реализации",
    "Количество дней реализации (дн.)",
    "Количество дней реализации (дн)",
    "Количество дней в реализации",
    "Дней в продаже",
    "Срок экспозиции (дн.)",
  ],
};

const ALFA_HEADER_ADDITIONS: Partial<HeaderAliases> = {
  offer_code: ["VIN / Зав.№", "VIN/Зав.№", "VIN", "VIN-код", "Зав.№"],
  status: ["Статус лота", "Состояние"],
  brand: ["Бренд", "Марка", "Предмет лизинга.Марка"],
  model: ["Модель", "Предмет лизинга.Модель"],
  modification: [
    "Подвид ТС",
    "Модельный ряд",
    "Комплектация",
    "Предмет лизинга.Тип предмета лизинга",
  ],
  vehicle_type: [
    "Тип ТС",
    "Вид ТС",
    "Тип транспортного средства",
    "Предмет лизинга.Тип транспортного средства",
    "Предмет лизинга.Тип предмета лизинга",
  ],
  year: ["Год", "Год выпуска"],
  mileage_km: ["Пробег", "Наработка", "Пробег (км)", "Пробег (м/ч)", "Наработка, м/ч"],
  key_count: ["Количество ключей", "Ключи"],
  pts_type: ["Тип ПТС", "ПТС"],
  has_encumbrance: ["Обременение", "Арест"],
  is_deregistered: ["Дата снятия с учета", "Учет прекращен"],
  responsible_person: ["Ответственный", "Менеджер продающий", "Менеджер резерва"],
  storage_address: ["Адрес стоянки", "Адрес места хранения", "Город", "Местонахождение", "Стоянка"],
  days_on_sale: ["Срок экспозиции (дн.)", "Дней в продаже"],
  price: ["Актуальная оценка", "Цена", "Утвержденная цена"],
  yandex_disk_url: ["Ссылка на фото", "Фото"],
  booking_status: ["Статус резерва", "Бронирование"],
  external_id: ["№ Лота", "№ п/п"],
  crm_ref: ["Номер договора", "CRM ID", "CRM ref"],
  website_url: [
    "Альфа-лизинг - Объявление",
    "Альфа-лизинг – Объявление",
    "Ссылка на источник",
    "URL на источник",
  ],
};

const SOVCOMBANK_HEADER_ADDITIONS: Partial<HeaderAliases> = {
  offer_code: ["VIN", "VIN-код", "VIN / Зав.№"],
  status: ["Признак"],
  brand: ["Марка"],
  model: ["Модель"],
  modification: ["Предмет лизинга", "Тех. Характеристики", "Колесная формула"],
  vehicle_type: ["Вид предмета лизинга"],
  year: ["Год выпуска"],
  mileage_km: ["Пробег/наработка км.ч/м.ч.", "Пробег", "Наработка"],
  key_count: ["Признак"],
  pts_type: ["Признак"],
  has_encumbrance: ["Ограничения ГИБДД", "Признак разукомплекта"],
  is_deregistered: ["Признак разукомплекта", "Учет спецтехники"],
  responsible_person: ["Менеджер"],
  storage_address: [
    "Адрес хранения (в БД)",
    "Адрес хранения",
    "Город хранения",
    "Область хранения",
  ],
  days_on_sale: ["Признак"],
  price: ["Текущая цена"],
  yandex_disk_url: ["Размещение объявления, ссылка"],
  booking_status: ["Признак"],
  external_id: ["№ п/п", "№п/п"],
  crm_ref: ["БД"],
  website_url: ["Размещение объявления, ссылка"],
};

function mergeAliases(
  base: HeaderAliases,
  overrides: Partial<HeaderAliases>,
): HeaderAliases {
  const merged = { ...base };
  (Object.keys(overrides) as CanonicalField[]).forEach((field) => {
    const aliases = overrides[field];
    if (aliases && aliases.length > 0) {
      merged[field] = aliases;
    }
  });
  return merged;
}

function extendAliases(
  base: HeaderAliases,
  additions: Partial<HeaderAliases>,
): HeaderAliases {
  const extended = { ...base };
  (Object.keys(additions) as CanonicalField[]).forEach((field) => {
    const aliases = additions[field];
    if (!aliases || aliases.length === 0) {
      return;
    }

    const merged = [...(extended[field] ?? []), ...aliases];
    extended[field] = [...new Set(merged)];
  });

  return extended;
}

export function createImportTenantProfiles(
  baseAliases: HeaderAliases,
): Record<ImportTenantId, ImportTenantProfile> {
  return {
    gpb: {
      id: "gpb",
      label: "ГПБ Лизинг",
      headerAliases: extendAliases(baseAliases, GPB_HEADER_ADDITIONS),
      offerCodeNormalizer: normalizeOfferCode,
    },
    reso: {
      id: "reso",
      label: "РЕСО Лизинг",
      headerAliases: mergeAliases(baseAliases, RESO_HEADER_OVERRIDES),
      offerCodeNormalizer: normalizeOfferCodePreserve,
    },
    alpha: {
      id: "alpha",
      label: "Альфа Лизинг",
      headerAliases: extendAliases(baseAliases, ALFA_HEADER_ADDITIONS),
      offerCodeNormalizer: normalizeOfferCode,
    },
    sovcombank: {
      id: "sovcombank",
      label: "Совкомбанк Лизинг",
      headerAliases: extendAliases(baseAliases, SOVCOMBANK_HEADER_ADDITIONS),
      offerCodeNormalizer: normalizeOfferCode,
    },
  };
}

export function parseImportTenantId(
  rawValue: unknown,
): ImportTenantId | null {
  if (
    rawValue === "gpb" ||
    rawValue === "reso" ||
    rawValue === "alpha" ||
    rawValue === "sovcombank"
  ) {
    return rawValue;
  }
  return null;
}
