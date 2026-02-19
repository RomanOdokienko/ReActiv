export const STRING_FILTER_KEYS = [
  "offerCode",
  "status",
  "brand",
  "model",
  "modification",
  "vehicleType",
  "ptsType",
  "responsiblePerson",
  "storageAddress",
  "bookingStatus",
  "externalId",
  "crmRef",
  "websiteUrl",
  "yandexDiskUrl",
] as const;

export const BOOLEAN_FILTER_KEYS = ["hasEncumbrance", "isDeregistered"] as const;

export const RANGE_FILTER_KEYS = [
  "priceMin",
  "priceMax",
  "yearMin",
  "yearMax",
  "mileageMin",
  "mileageMax",
  "keyCountMin",
  "keyCountMax",
  "daysOnSaleMin",
  "daysOnSaleMax",
] as const;

export type StringFilterKey = (typeof STRING_FILTER_KEYS)[number];
export type BooleanFilterKey = (typeof BOOLEAN_FILTER_KEYS)[number];
export type RangeFilterKey = (typeof RANGE_FILTER_KEYS)[number];

export type SelectedFilters = Record<StringFilterKey | BooleanFilterKey, string[]>;
export type RangeFilters = Record<RangeFilterKey, string>;

export const INITIAL_RANGES: RangeFilters = {
  priceMin: "",
  priceMax: "",
  yearMin: "",
  yearMax: "",
  mileageMin: "",
  mileageMax: "",
  keyCountMin: "",
  keyCountMax: "",
  daysOnSaleMin: "",
  daysOnSaleMax: "",
};

export const FILTER_LABELS: Record<string, string> = {
  offerCode: "Код предложения",
  status: "Статус",
  brand: "Марка",
  model: "Модель",
  modification: "Модификация",
  vehicleType: "Тип ТС",
  ptsType: "ПТС/ЭПТС",
  responsiblePerson: "Ответственный",
  storageAddress: "Место хранения",
  bookingStatus: "Статус брони",
  externalId: "ID",
  crmRef: "CRM",
  websiteUrl: "Ссылка на сайт",
  yandexDiskUrl: "Яндекс Диск",
  hasEncumbrance: "Обременение",
  isDeregistered: "Снят с учета",
  priceMin: "Цена от",
  priceMax: "Цена до",
  yearMin: "Год от",
  yearMax: "Год до",
  mileageMin: "Пробег от",
  mileageMax: "Пробег до",
  keyCountMin: "Ключи от",
  keyCountMax: "Ключи до",
  daysOnSaleMin: "Дней в продаже от",
  daysOnSaleMax: "Дней в продаже до",
};

export const SORT_OPTIONS = [
  { value: "created_at", label: "По дате" },
  { value: "price", label: "По цене" },
  { value: "year", label: "По году" },
  { value: "mileage_km", label: "По пробегу" },
  { value: "days_on_sale", label: "По дням продажи" },
] as const;
