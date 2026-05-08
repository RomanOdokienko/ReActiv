import type { CanonicalField } from "../domain/types";
import { normalizeOfferCode, normalizeOfferCodePreserve } from "./normalize-offer-code";

export type ImportTenantId =
  | "gpb"
  | "reso"
  | "alpha"
  | "sovcombank"
  | "sber"
  | "vtb"
  | "carcade";

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
  status: [
    "status",
    "\u0421\u0442\u0430\u0442\u0443\u0441",
    "\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435",
    "\u0421\u0442\u0430\u0442\u0443\u0441 \u043b\u043e\u0442\u0430",
  ],
  pts_type: [
    "pts_type",
    "\u041f\u0422\u0421/\u042d\u041f\u0422\u0421",
    "\u0422\u0438\u043f \u041f\u0422\u0421",
    "\u041f\u0422\u0421",
  ],
  has_encumbrance: [
    "has_encumbrance",
    "\u041d\u0430\u043b\u0438\u0447\u0438\u0435 \u043e\u0431\u0440\u0435\u043c\u0435\u043d\u0435\u043d\u0438\u044f",
    "\u041e\u0431\u0440\u0435\u043c\u0435\u043d\u0435\u043d\u0438\u0435",
    "\u041e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f \u0413\u0418\u0411\u0414\u0414",
    "\u0410\u0440\u0435\u0441\u0442",
  ],
  is_deregistered: [
    "is_deregistered",
    "\u0421\u043d\u044f\u0442 \u0441 \u0443\u0447\u0435\u0442\u0430",
    "\u0414\u0430\u0442\u0430 \u0441\u043d\u044f\u0442\u0438\u044f \u0441 \u0443\u0447\u0435\u0442\u0430",
    "\u0423\u0447\u0435\u0442 \u043f\u0440\u0435\u043a\u0440\u0430\u0449\u0435\u043d",
  ],
  responsible_person: [
    "responsible_person",
    "\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439",
    "\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u0437\u0430 \u0422\u0421",
    "\u041e\u0442\u0432\u0435\u0442\u0441\u0432\u0435\u043d\u043d\u044b\u0439 \u0437\u0430 \u0422\u0421",
    "\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u0437\u0430 TC",
    "\u041e\u0442\u0432\u0435\u0442\u0441\u0432\u0435\u043d\u043d\u044b\u0439 \u0437\u0430 TC",
    "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u043f\u0440\u043e\u0434\u0430\u044e\u0449\u0438\u0439",
    "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440",
  ],
  storage_address: [
    "storage_address",
    "\u0410\u0434\u0440\u0435\u0441 \u043c\u0435\u0441\u0442\u0430 \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f",
    "\u041c\u0435\u0441\u0442\u043e\u043d\u0430\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435",
    "\u0410\u0434\u0440\u0435\u0441 \u0441\u0442\u043e\u044f\u043d\u043a\u0438",
    "\u0421\u0442\u043e\u044f\u043d\u043a\u0430",
    "\u0413\u043e\u0440\u043e\u0434",
  ],
  days_on_sale: [
    "days_on_sale",
    "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0434\u043d\u0435\u0439 \u0440\u0435\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0438",
    "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0434\u043d\u0435\u0439 \u0440\u0435\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0438 (\u0434\u043d.)",
    "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0434\u043d\u0435\u0439 \u0440\u0435\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0438 (\u0434\u043d)",
    "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0434\u043d\u0435\u0439 \u0432 \u0440\u0435\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0438",
    "\u0414\u043d\u0435\u0439 \u0432 \u043f\u0440\u043e\u0434\u0430\u0436\u0435",
    "\u0421\u0440\u043e\u043a \u044d\u043a\u0441\u043f\u043e\u0437\u0438\u0446\u0438\u0438 (\u0434\u043d.)",
  ],
  price: [
    "price",
    "\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c",
    "\u0426\u0435\u043d\u0430",
    "\u0423\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043d\u0430\u044f \u0446\u0435\u043d\u0430",
    "\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u0446\u0435\u043d\u0430",
    "\u0410\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u0430\u044f \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c",
    "\u0410\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0446\u0435\u043d\u043a\u0430",
    "\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c, \u0440\u0443\u0431.",
    "\u0426\u0435\u043d\u0430 \u0440\u0435\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0438",
  ],
  yandex_disk_url: [
    "yandex_disk_url",
    "\u042f\u043d\u0434\u0435\u043a\u0441 \u0434\u0438\u0441\u043a",
    "\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0444\u043e\u0442\u043e",
    "\u0424\u043e\u0442\u043e",
  ],
  booking_status: [
    "booking_status",
    "\u0421\u0442\u0430\u0442\u0443\u0441 \u0431\u0440\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f",
    "\u0421\u0442\u0430\u0442\u0443\u0441 \u0440\u0435\u0437\u0435\u0440\u0432\u0430",
    "\u0411\u0440\u043e\u043d\u044c",
    "\u0411\u0440\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435",
  ],
  external_id: [
    "external_id",
    "id",
    "ID",
    "ID \u043b\u043e\u0442\u0430",
    "\u2116 \u041b\u043e\u0442\u0430",
    "\u2116 \u043f/\u043f",
  ],
  crm_ref: [
    "crm_ref",
    "crm",
    "CRM",
    "CRM ID",
    "CRM ref",
    "\u041d\u043e\u043c\u0435\u0440 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430",
  ],
  website_url: [
    "website_url",
    "\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0441\u0430\u0439\u0442",
    "\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a",
    "URL \u043d\u0430 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a",
    "\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435",
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
  price: ["Актуальная стоимость", "Актуальная оценка", "Цена", "Утвержденная цена"],
  yandex_disk_url: ["Ссылка на фото", "Фото"],
  booking_status: ["Статус", "Статус резерва", "Бронирование"],
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

const SBER_HEADER_ADDITIONS: Partial<HeaderAliases> = {
  offer_code: ["offer_code", "vin", "VIN", "Код предложения"],
  status: ["status", "Статус"],
  brand: ["brand", "Марка"],
  model: ["model", "Модель"],
  modification: ["modification", "Модификация"],
  vehicle_type: ["vehicle_type", "Тип ТС", "Тип техники"],
  year: ["year", "Год выпуска"],
  mileage_km: ["mileage_km", "Пробег, км", "Пробег"],
  key_count: ["key_count", "Количество ключей"],
  pts_type: ["pts_type", "ПТС/ЭПТС"],
  has_encumbrance: ["has_encumbrance", "Наличие обременения"],
  is_deregistered: ["is_deregistered", "Снят с учета"],
  responsible_person: ["responsible_person", "Ответственный"],
  storage_address: ["storage_address", "Адрес места хранения", "Город"],
  days_on_sale: ["days_on_sale", "Количество дней реализации"],
  price: ["price", "Стоимость"],
  yandex_disk_url: ["yandex_disk_url", "Ссылка на фото", "Фото"],
  booking_status: ["booking_status", "Статус бронирования"],
  external_id: ["external_id", "ID", "ID лота"],
  crm_ref: ["crm_ref", "CRM"],
  website_url: ["website_url", "Ссылка на сайт", "Ссылка на источник"],
};

const VTB_HEADER_ADDITIONS: Partial<HeaderAliases> = {
  offer_code: ["offer_code", "vin", "VIN", "Код предложения", "Код лота"],
  status: ["status", "Статус"],
  brand: ["brand", "Марка"],
  model: ["model", "Модель"],
  modification: ["modification", "Модификация"],
  vehicle_type: ["vehicle_type", "Тип ТС", "Тип техники"],
  year: ["year", "Год выпуска"],
  mileage_km: ["mileage_km", "Пробег, км", "Пробег"],
  key_count: ["key_count", "Количество ключей"],
  pts_type: ["pts_type", "ПТС/ЭПТС"],
  has_encumbrance: ["has_encumbrance", "Наличие обременения"],
  is_deregistered: ["is_deregistered", "Снят с учета"],
  responsible_person: ["responsible_person", "Ответственный"],
  storage_address: ["storage_address", "Адрес места хранения", "Город"],
  days_on_sale: ["days_on_sale", "Количество дней реализации"],
  price: ["price", "Стоимость", "Цена"],
  yandex_disk_url: ["yandex_disk_url", "Ссылка на фото", "Фото"],
  booking_status: ["booking_status", "Статус бронирования", "Бронь"],
  external_id: ["external_id", "ID", "ID лота"],
  crm_ref: ["crm_ref", "CRM"],
  website_url: ["website_url", "Ссылка на сайт", "Ссылка на источник"],
};

const CARCADE_HEADER_ADDITIONS: Partial<HeaderAliases> = {
  offer_code: ["offer_code", "vin", "VIN", "Код предложения"],
  status: ["status", "Статус"],
  brand: ["brand", "Марка"],
  model: ["model", "Модель"],
  modification: ["modification", "Модификация"],
  vehicle_type: ["vehicle_type", "Тип ТС", "Тип техники"],
  year: ["year", "Год выпуска"],
  mileage_km: ["mileage_km", "Пробег, км", "Пробег"],
  key_count: ["key_count", "Количество ключей"],
  pts_type: ["pts_type", "ПТС/ЭПТС"],
  has_encumbrance: ["has_encumbrance", "Наличие обременения"],
  is_deregistered: ["is_deregistered", "Снят с учета"],
  responsible_person: ["responsible_person", "Ответственный"],
  storage_address: ["storage_address", "Адрес места хранения", "Город"],
  days_on_sale: ["days_on_sale", "Количество дней реализации"],
  price: ["price", "Стоимость", "Цена"],
  yandex_disk_url: ["yandex_disk_url", "Ссылка на фото", "Фото"],
  booking_status: ["booking_status", "Статус бронирования", "Бронь"],
  external_id: ["external_id", "ID", "ID лота"],
  crm_ref: ["crm_ref", "CRM"],
  website_url: ["website_url", "Ссылка на сайт", "Ссылка на источник"],
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
    sber: {
      id: "sber",
      label: "СберЛизинг",
      headerAliases: extendAliases(baseAliases, SBER_HEADER_ADDITIONS),
      offerCodeNormalizer: normalizeOfferCode,
    },
    vtb: {
      id: "vtb",
      label: "ВТБ Лизинг",
      headerAliases: extendAliases(baseAliases, VTB_HEADER_ADDITIONS),
      offerCodeNormalizer: normalizeOfferCode,
    },
    carcade: {
      id: "carcade",
      label: "CARCADE",
      headerAliases: extendAliases(baseAliases, CARCADE_HEADER_ADDITIONS),
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
    rawValue === "sovcombank" ||
    rawValue === "sber" ||
    rawValue === "vtb" ||
    rawValue === "carcade"
  ) {
    return rawValue;
  }
  return null;
}
