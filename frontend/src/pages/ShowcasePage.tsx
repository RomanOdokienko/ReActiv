import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCatalogFilters,
  getCatalogItems,
  getMediaPreviewImageUrl,
} from "../api/client";
import type {
  CatalogFiltersResponse,
  CatalogItem,
  CatalogItemsResponse,
} from "../types/api";

type BookingPreset = "Свободен" | "Забронирован" | "На согласовании";

const BOOKING_PRESETS: BookingPreset[] = [
  "Свободен",
  "Забронирован",
  "На согласовании",
];

type ViewMode = "grid" | "list";
type SortDirection = "asc" | "desc";

interface ShowcaseUiState {
  bookingPreset: "" | BookingPreset;
  city: string;
  selectedVehicleTypes: string[];
  brand: string;
  model: string;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  yearMax: string;
  mileageMin: string;
  mileageMax: string;
  sortBy: string;
  sortDir: string;
  dateSortDir: SortDirection;
  priceSortDir: SortDirection;
  viewMode: ViewMode;
  page: number;
}

const SHOWCASE_UI_STATE_KEY = "showcase_ui_state_v1";
const SHOWCASE_RETURN_FLAG_KEY = "showcase_return_pending_v1";
const SHOWCASE_SCROLL_Y_KEY = "showcase_scroll_y_v1";

function readShowcaseUiState(): Partial<ShowcaseUiState> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(SHOWCASE_UI_STATE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Partial<ShowcaseUiState>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function writeShowcaseUiState(state: ShowcaseUiState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(SHOWCASE_UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function formatPrice(price: number): string {
  return `${price.toLocaleString("ru-RU")} ₽`;
}

function extractMediaUrls(rawValue: string): string[] {
  if (!rawValue.trim()) {
    return [];
  }

  const matches = rawValue.match(/https?:\/\/\S+/gi) ?? [];
  const cleaned = matches
    .map((item) => item.replace(/[),.;]+$/g, "").trim())
    .filter(Boolean);

  return [...new Set(cleaned)];
}

function extractBracketDetails(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const matches = [...value.matchAll(/\(([^()]+)\)/g)];
  if (!matches.length) {
    return null;
  }

  const detail = matches[matches.length - 1]?.[1]?.trim() ?? "";
  return detail || null;
}

function buildCardSubtitle(item: CatalogItem): string {
  const titleDetails = extractBracketDetails(item.title);
  const modificationDetails = extractBracketDetails(item.modification);
  const fallback = item.modification || item.vehicleType;
  const rawDetails = titleDetails || modificationDetails || fallback;
  const cleanedDetails = rawDetails
    .replace(/\s+/g, " ")
    .replace(/^\W+|\W+$/g, "")
    .trim();

  return `${item.year} г, ${cleanedDetails}`;
}

function normalizeIntegerInput(raw: string): string {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) {
    return "";
  }

  return digitsOnly.replace(/^0+(?=\d)/, "");
}

function formatIntegerWithSpaces(value: string): string {
  if (!value) {
    return "";
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return parsed.toLocaleString("ru-RU");
}

function sortUniqueValues(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right, "ru", { sensitivity: "base" }),
  );
}

export function ShowcasePage() {
  const pageSize = 20;
  const restoredState = useMemo(readShowcaseUiState, []);
  const hasRestoredScrollRef = useRef(false);
  const restoreAttemptsRef = useRef(0);
  const restoreTimeoutRef = useRef<number | null>(null);
  const initialBookingPreset =
    restoredState.bookingPreset && BOOKING_PRESETS.includes(restoredState.bookingPreset)
      ? restoredState.bookingPreset
      : "";

  const [filters, setFilters] = useState<CatalogFiltersResponse | null>(null);
  const [itemsResponse, setItemsResponse] = useState<CatalogItemsResponse | null>(
    null,
  );
  const [bookingPreset, setBookingPreset] = useState<"" | BookingPreset>(initialBookingPreset);
  const [city, setCity] = useState(restoredState.city ?? "");
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>(
    Array.isArray(restoredState.selectedVehicleTypes)
      ? restoredState.selectedVehicleTypes
      : [],
  );
  const [brand, setBrand] = useState(restoredState.brand ?? "");
  const [model, setModel] = useState(restoredState.model ?? "");
  const [priceMin, setPriceMin] = useState(restoredState.priceMin ?? "");
  const [priceMax, setPriceMax] = useState(restoredState.priceMax ?? "");
  const [yearMin, setYearMin] = useState(restoredState.yearMin ?? "");
  const [yearMax, setYearMax] = useState(restoredState.yearMax ?? "");
  const [mileageMin, setMileageMin] = useState(restoredState.mileageMin ?? "");
  const [mileageMax, setMileageMax] = useState(restoredState.mileageMax ?? "");
  const [sortBy, setSortBy] = useState(restoredState.sortBy ?? "created_at");
  const [sortDir, setSortDir] = useState(restoredState.sortDir ?? "desc");
  const [dateSortDir, setDateSortDir] = useState<SortDirection>(
    restoredState.dateSortDir ?? "desc",
  );
  const [priceSortDir, setPriceSortDir] = useState<SortDirection>(
    restoredState.priceSortDir ?? "asc",
  );
  const [viewMode, setViewMode] = useState<ViewMode>(restoredState.viewMode ?? "grid");
  const [page, setPage] = useState(
    Number.isInteger(restoredState.page) && (restoredState.page ?? 0) > 0
      ? (restoredState.page as number)
      : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") {
        return;
      }

      if (restoreTimeoutRef.current !== null) {
        window.clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncViewportState = () => {
      setIsMobileViewport(window.innerWidth <= 760);
    };

    syncViewportState();
    window.addEventListener("resize", syncViewportState);

    return () => {
      window.removeEventListener("resize", syncViewportState);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport && isMobileFiltersOpen) {
      setIsMobileFiltersOpen(false);
    }
  }, [isMobileFiltersOpen, isMobileViewport]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (isMobileViewport && isMobileFiltersOpen) {
      document.body.classList.add("showcase-mobile-lock");
      return () => {
        document.body.classList.remove("showcase-mobile-lock");
      };
    }

    document.body.classList.remove("showcase-mobile-lock");
  }, [isMobileFiltersOpen, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport || !isMobileFiltersOpen || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileFiltersOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileFiltersOpen, isMobileViewport]);

  useEffect(() => {
    async function loadFilters() {
      try {
        const data = await getCatalogFilters();
        setFilters(data);
      } catch {
        setError("Не удалось загрузить фильтры");
      }
    }

    void loadFilters();
  }, []);

  const query = useMemo(() => {
    const queryObject: Record<string, string | number | string[]> = {
      page,
      pageSize,
      sortBy,
      sortDir,
    };

    if (bookingPreset) {
      queryObject.bookingStatus = bookingPreset;
    }
    if (city) {
      queryObject.city = city;
    }
    if (selectedVehicleTypes.length > 0) {
      queryObject.vehicleType = selectedVehicleTypes;
    }
    if (brand) {
      queryObject.brand = brand;
    }
    if (model) {
      queryObject.model = model;
    }
    if (priceMin !== "") {
      queryObject.priceMin = Number(priceMin);
    }
    if (priceMax !== "") {
      queryObject.priceMax = Number(priceMax);
    }
    if (yearMin !== "") {
      queryObject.yearMin = Number(yearMin);
    }
    if (yearMax !== "") {
      queryObject.yearMax = Number(yearMax);
    }
    if (mileageMin !== "") {
      queryObject.mileageMin = Number(mileageMin);
    }
    if (mileageMax !== "") {
      queryObject.mileageMax = Number(mileageMax);
    }

    return queryObject;
  }, [
    bookingPreset,
    brand,
    city,
    priceMax,
    priceMin,
    mileageMax,
    mileageMin,
    model,
    page,
    selectedVehicleTypes,
    sortBy,
    sortDir,
    yearMax,
    yearMin,
  ]);

  useEffect(() => {
    async function loadItems() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getCatalogItems(query);
        setItemsResponse(response);
      } catch {
        setError("Не удалось загрузить витрину");
      } finally {
        setIsLoading(false);
      }
    }

    void loadItems();
  }, [query]);

  useEffect(() => {
    writeShowcaseUiState({
      bookingPreset,
      city,
      selectedVehicleTypes,
      brand,
      model,
      priceMin,
      priceMax,
      yearMin,
      yearMax,
      mileageMin,
      mileageMax,
      sortBy,
      sortDir,
      dateSortDir,
      priceSortDir,
      viewMode,
      page,
    });
  }, [
    bookingPreset,
    city,
    selectedVehicleTypes,
    brand,
    model,
    priceMin,
    priceMax,
    yearMin,
    yearMax,
    mileageMin,
    mileageMax,
    sortBy,
    sortDir,
    dateSortDir,
    priceSortDir,
    viewMode,
    page,
  ]);

  const items: CatalogItem[] = itemsResponse?.items ?? [];
  const total = itemsResponse?.pagination.total ?? 0;
  const hasImportedData = total > 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const vehicleTypeOptions = filters?.vehicleType ?? [];
  const effectiveViewMode: ViewMode = isMobileViewport ? "list" : viewMode;
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (bookingPreset) {
      count += 1;
    }
    if (city) {
      count += 1;
    }
    if (selectedVehicleTypes.length > 0) {
      count += 1;
    }
    if (brand) {
      count += 1;
    }
    if (model) {
      count += 1;
    }
    if (priceMin) {
      count += 1;
    }
    if (priceMax) {
      count += 1;
    }
    if (yearMin) {
      count += 1;
    }
    if (yearMax) {
      count += 1;
    }
    if (mileageMin) {
      count += 1;
    }
    if (mileageMax) {
      count += 1;
    }
    return count;
  }, [
    bookingPreset,
    brand,
    city,
    mileageMax,
    mileageMin,
    model,
    priceMax,
    priceMin,
    selectedVehicleTypes,
    yearMax,
    yearMin,
  ]);

  useEffect(() => {
    if (hasRestoredScrollRef.current || isLoading || !itemsResponse) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (restoreTimeoutRef.current !== null) {
      return;
    }

    const returnPending = window.sessionStorage.getItem(SHOWCASE_RETURN_FLAG_KEY);
    if (returnPending !== "1") {
      return;
    }

    const rawScrollY = window.sessionStorage.getItem(SHOWCASE_SCROLL_Y_KEY);
    const scrollY = Number(rawScrollY);
    const targetY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;

    const maxAttempts = 40;

    const restoreScrollPosition = () => {
      window.scrollTo({ top: targetY, behavior: "auto" });

      const reachedTarget = Math.abs(window.scrollY - targetY) <= 2;
      if (reachedTarget || restoreAttemptsRef.current >= maxAttempts) {
        hasRestoredScrollRef.current = true;
        restoreAttemptsRef.current = 0;
        window.sessionStorage.removeItem(SHOWCASE_RETURN_FLAG_KEY);
        restoreTimeoutRef.current = null;
        return;
      }

      restoreAttemptsRef.current += 1;
      restoreTimeoutRef.current = window.setTimeout(restoreScrollPosition, 120);
    };

    window.requestAnimationFrame(restoreScrollPosition);

    return () => {
      if (restoreTimeoutRef.current !== null) {
        window.clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }
    };
  }, [isLoading, itemsResponse, items.length]);

  useEffect(() => {
    if (vehicleTypeOptions.length === 0) {
      return;
    }

    setSelectedVehicleTypes((current) =>
      current.filter((value) => vehicleTypeOptions.includes(value)),
    );
  }, [vehicleTypeOptions]);

  const availableBrands = useMemo(() => {
    if (!filters) {
      return [];
    }

    if (selectedVehicleTypes.length === 0) {
      return filters.brand;
    }

    const brandsByVehicleType = filters.brandsByVehicleType ?? {};
    const modelsByBrandAndVehicleType = filters.modelsByBrandAndVehicleType ?? {};
    const hasVehicleTypeMetadata =
      Object.keys(brandsByVehicleType).length > 0 ||
      Object.keys(modelsByBrandAndVehicleType).length > 0;

    if (!hasVehicleTypeMetadata) {
      return filters.brand;
    }

    const selectedVehicleTypeKeys = new Set(
      selectedVehicleTypes.map((value) => value.trim().toLowerCase()),
    );
    const union = new Set<string>();

    Object.entries(brandsByVehicleType).forEach(([vehicleType, brands]) => {
      if (!selectedVehicleTypeKeys.has(vehicleType.trim().toLowerCase())) {
        return;
      }

      brands.forEach((value) => {
        union.add(value);
      });
    });

    if (union.size === 0) {
      Object.entries(modelsByBrandAndVehicleType).forEach(
        ([vehicleType, modelsByBrand]) => {
          if (!selectedVehicleTypeKeys.has(vehicleType.trim().toLowerCase())) {
            return;
          }

          Object.keys(modelsByBrand).forEach((value) => {
            union.add(value);
          });
        },
      );
    }

    return sortUniqueValues(union);
  }, [filters, selectedVehicleTypes]);

  const availableModels = useMemo(() => {
    if (!filters || !brand) {
      return [];
    }

    if (selectedVehicleTypes.length === 0) {
      return filters.modelsByBrand?.[brand] ?? [];
    }

    const modelsByBrandAndVehicleType = filters.modelsByBrandAndVehicleType ?? {};
    const hasVehicleTypeMetadata = Object.keys(modelsByBrandAndVehicleType).length > 0;

    if (!hasVehicleTypeMetadata) {
      return filters.modelsByBrand?.[brand] ?? [];
    }

    const selectedVehicleTypeKeys = new Set(
      selectedVehicleTypes.map((value) => value.trim().toLowerCase()),
    );
    const union = new Set<string>();

    Object.entries(modelsByBrandAndVehicleType).forEach(
      ([vehicleType, modelsByBrand]) => {
        if (!selectedVehicleTypeKeys.has(vehicleType.trim().toLowerCase())) {
          return;
        }

        (modelsByBrand[brand] ?? []).forEach((value) => {
          union.add(value);
        });
      },
    );

    return sortUniqueValues(union);
  }, [brand, filters, selectedVehicleTypes]);

  useEffect(() => {
    if (!brand) {
      return;
    }

    if (!availableBrands.includes(brand)) {
      setBrand("");
      setModel("");
      setPage(1);
    }
  }, [availableBrands, brand]);

  useEffect(() => {
    if (!model) {
      return;
    }

    if (!availableModels.includes(model)) {
      setModel("");
      setPage(1);
    }
  }, [availableModels, model]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, index) => String(currentYear - index));
  }, []);

  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: Array<number | "ellipsis"> = [1];
    const left = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);

    if (left > 2) {
      pages.push("ellipsis");
    }

    for (let pageNumber = left; pageNumber <= right; pageNumber += 1) {
      pages.push(pageNumber);
    }

    if (right < totalPages - 1) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  function applyDateSortSelection(value: "asc" | "desc"): void {
    setPage(1);
    setDateSortDir(value);
    setSortBy("created_at");
    setSortDir(value);
  }

  function applyPriceSortSelection(value: "asc" | "desc"): void {
    setPage(1);
    setPriceSortDir(value);
    setSortBy("price");
    setSortDir(value);
  }

  function clearFilters(): void {
    setBookingPreset("");
    setCity("");
    setSelectedVehicleTypes([]);
    setBrand("");
    setModel("");
    setPriceMin("");
    setPriceMax("");
    setYearMin("");
    setYearMax("");
    setMileageMin("");
    setMileageMax("");
    setPage(1);
  }

  function toggleBookingPreset(nextPreset: BookingPreset): void {
    setPage(1);
    setBookingPreset((current) => (current === nextPreset ? "" : nextPreset));
  }

  function toggleVehicleType(value: string): void {
    setPage(1);
    setSelectedVehicleTypes((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }

      return [...current, value];
    });
  }

  function clearVehicleTypeSelection(): void {
    setPage(1);
    setSelectedVehicleTypes([]);
  }

  function getBookingPresetChipClassName(preset: BookingPreset): string {
    const baseClass = "chip chip--booking";
    const isActive = bookingPreset === preset;

    if (preset === "Свободен") {
      return `${baseClass} chip--booking-free${isActive ? " active" : ""}`;
    }

    if (preset === "Забронирован") {
      return `${baseClass} chip--booking-booked${isActive ? " active" : ""}`;
    }

    return `${baseClass} chip--booking-review${isActive ? " active" : ""}`;
  }

  function getVehicleTypeLabel(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (normalized === "специализированный транспорт") {
      return "СПЕЦТРАНСПОРТ";
    }

    return value;
  }

  function getMarketTag(daysOnSale: number): { label: string; className: string } {
    if (daysOnSale <= 30) {
      return { label: "цена в рынке", className: "badge-market market" };
    }
    if (daysOnSale <= 90) {
      return { label: "ниже рынка", className: "badge-market good" };
    }
    return { label: "выше рынка", className: "badge-market bad" };
  }

  return (
    <section className="showcase-page">
      <h1>Витрина</h1>
      {error && <p className="error">{error}</p>}

      <main className="showcase-main">
        <div className="showcase-mobile-filter-bar">
          <button
            type="button"
            className="showcase-mobile-filter-toggle"
            onClick={() => setIsMobileFiltersOpen(true)}
            aria-expanded={isMobileFiltersOpen}
            aria-controls="showcase-filter-panel"
          >
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="showcase-mobile-filter-count">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        <div
          className={
            isMobileFiltersOpen
              ? "showcase-filter-drawer showcase-filter-drawer--open"
              : "showcase-filter-drawer"
          }
        >
          <button
            type="button"
            className="showcase-filter-drawer__backdrop"
            aria-label="Закрыть фильтры"
            onClick={() => setIsMobileFiltersOpen(false)}
          />

          <div
            className="showcase-filter-panel"
            id="showcase-filter-panel"
            role={isMobileViewport ? "dialog" : undefined}
            aria-modal={isMobileViewport ? "true" : undefined}
            aria-label={isMobileViewport ? "Фильтры витрины" : undefined}
          >
            <div className="showcase-filter-mobile-header">
              <strong>Фильтры</strong>
              <button
                type="button"
                className="secondary-button showcase-filter-mobile-close"
                onClick={() => setIsMobileFiltersOpen(false)}
              >
                Закрыть
              </button>
            </div>

            <div className="showcase-filter-group">
              <p className="showcase-filter-group-title">Статус техники</p>
              <div className="showcase-presets">
                {BOOKING_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={getBookingPresetChipClassName(preset)}
                    onClick={() => toggleBookingPreset(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="showcase-filter-grid showcase-filter-grid--type">
              <div className="vehicle-type-picker">
                <div className="vehicle-type-picker__row">
                  <div className="vehicle-type-picker__chips">
                    <button
                      type="button"
                      className={selectedVehicleTypes.length === 0 ? "vehicle-type-chip active" : "vehicle-type-chip"}
                      onClick={clearVehicleTypeSelection}
                    >
                      Все виды техники
                    </button>

                    {vehicleTypeOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={selectedVehicleTypes.includes(value) ? "vehicle-type-chip active" : "vehicle-type-chip"}
                        onClick={() => toggleVehicleType(value)}
                        title={value}
                      >
                        {getVehicleTypeLabel(value)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="secondary-button showcase-reset-button"
                    onClick={clearFilters}
                  >
                    Сбросить фильтры
                  </button>
                </div>
              </div>
            </div>

            <div className="showcase-filter-grid showcase-filter-grid--triple">
              <select
                className={`${city ? "showcase-filter is-active" : "showcase-filter"} showcase-filter--select`}
                value={city}
                onChange={(event) => {
                  setPage(1);
                  setCity(event.target.value);
                }}
              >
                <option value="">Регион</option>
                {(filters?.city ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                className={`${brand ? "showcase-filter is-active" : "showcase-filter"} showcase-filter--select`}
                value={brand}
                disabled={availableBrands.length === 0}
                onChange={(event) => {
                  setPage(1);
                  setBrand(event.target.value);
                }}
              >
                <option value="">
                  {availableBrands.length === 0 ? "Нет марок" : "Марка"}
                </option>
                {availableBrands.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                className={`${model ? "showcase-filter is-active" : "showcase-filter"} showcase-filter--select`}
                value={model}
                disabled={brand === "" || availableModels.length === 0}
                onChange={(event) => {
                  setPage(1);
                  setModel(event.target.value);
                }}
              >
                <option value="">
                  {brand === ""
                    ? "Сначала выберите марку"
                    : availableModels.length === 0
                      ? "Нет моделей"
                      : "Модель"}
                </option>
                {availableModels.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="showcase-filter-grid showcase-filter-grid--paired">
              <div className="showcase-filter-pair">
                <input
                  type="text"
                  inputMode="numeric"
                  className={priceMin ? "showcase-filter is-active" : "showcase-filter"}
                  placeholder="Цена от, ₽"
                  value={formatIntegerWithSpaces(priceMin)}
                  onChange={(event) => {
                    setPage(1);
                    setPriceMin(normalizeIntegerInput(event.target.value));
                  }}
                />

                <input
                  type="text"
                  inputMode="numeric"
                  className={priceMax ? "showcase-filter is-active" : "showcase-filter"}
                  placeholder="Цена до, ₽"
                  value={formatIntegerWithSpaces(priceMax)}
                  onChange={(event) => {
                    setPage(1);
                    setPriceMax(normalizeIntegerInput(event.target.value));
                  }}
                />
              </div>

              <div className="showcase-filter-pair">
                <select
                  className={`${yearMin ? "showcase-filter is-active" : "showcase-filter"} showcase-filter--select`}
                  value={yearMin}
                  onChange={(event) => {
                    setPage(1);
                    const nextYearMin = event.target.value;
                    setYearMin(nextYearMin);
                    if (nextYearMin && yearMax && Number(nextYearMin) > Number(yearMax)) {
                      setYearMax(nextYearMin);
                    }
                  }}
                >
                  <option value="">Год от</option>
                  {yearOptions.map((yearValue) => (
                    <option key={`year-min-${yearValue}`} value={yearValue}>
                      {yearValue}
                    </option>
                  ))}
                </select>

                <select
                  className={`${yearMax ? "showcase-filter is-active" : "showcase-filter"} showcase-filter--select`}
                  value={yearMax}
                  onChange={(event) => {
                    setPage(1);
                    const nextYearMax = event.target.value;
                    setYearMax(nextYearMax);
                    if (nextYearMax && yearMin && Number(nextYearMax) < Number(yearMin)) {
                      setYearMin(nextYearMax);
                    }
                  }}
                >
                  <option value="">Год до</option>
                  {yearOptions.map((yearValue) => (
                    <option key={`year-max-${yearValue}`} value={yearValue}>
                      {yearValue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="showcase-filter-pair">
                <input
                  type="text"
                  inputMode="numeric"
                  className={mileageMin ? "showcase-filter is-active" : "showcase-filter"}
                  placeholder="Пробег от, км"
                  value={formatIntegerWithSpaces(mileageMin)}
                  onChange={(event) => {
                    setPage(1);
                    setMileageMin(normalizeIntegerInput(event.target.value));
                  }}
                />

                <input
                  type="text"
                  inputMode="numeric"
                  className={mileageMax ? "showcase-filter is-active" : "showcase-filter"}
                  placeholder="Пробег до, км"
                  value={formatIntegerWithSpaces(mileageMax)}
                  onChange={(event) => {
                    setPage(1);
                    setMileageMax(normalizeIntegerInput(event.target.value));
                  }}
                />
              </div>
            </div>

            <div className="showcase-filter-mobile-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Сбросить все
              </button>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
              >
                Показать {total.toLocaleString("ru-RU")}
              </button>
            </div>
          </div>
        </div>

        <div className="showcase-meta">
          <strong>Найдено {total.toLocaleString("ru-RU")} позиций</strong>
          <div className="showcase-meta-controls">
            <div className="showcase-sort showcase-sort--split">
              <select
                className="showcase-filter showcase-filter--select showcase-sort-select"
                value={dateSortDir}
                onChange={(event) =>
                  applyDateSortSelection(event.target.value as "asc" | "desc")
                }
                aria-label="Сортировка по дате"
              >
                <option value="desc">Сначала новые</option>
                <option value="asc">Сначала старые</option>
              </select>
              <select
                className="showcase-filter showcase-filter--select showcase-sort-select"
                value={priceSortDir}
                onChange={(event) =>
                  applyPriceSortSelection(event.target.value as "asc" | "desc")
                }
                aria-label="Сортировка по цене"
              >
                <option value="asc">Сначала дешевле</option>
                <option value="desc">Сначала дороже</option>
              </select>
            </div>

            <div className="view-switch showcase-view-switch">
              <button
                type="button"
                className={effectiveViewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
                aria-label="Сетка"
                title="Сетка"
              >
                <svg viewBox="0 0 20 20" role="presentation" focusable="false">
                  <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" />
                  <rect x="11.5" y="2.5" width="6" height="6" rx="1.2" />
                  <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" />
                  <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" />
                </svg>
              </button>
              <button
                type="button"
                className={effectiveViewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
                aria-label="По порядку"
                title="По порядку"
              >
                <svg viewBox="0 0 20 20" role="presentation" focusable="false">
                  <rect x="2.5" y="3" width="15" height="3" rx="1.2" />
                  <rect x="2.5" y="8.5" width="15" height="3" rx="1.2" />
                  <rect x="2.5" y="14" width="15" height="3" rx="1.2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {isLoading && <p>Загрузка витрины...</p>}

        {!isLoading && !hasImportedData && (
          <p className="empty">Импортированных данных пока нет.</p>
        )}

        {!isLoading && hasImportedData && items.length === 0 && (
          <p className="empty">По текущим фильтрам ничего не найдено.</p>
        )}

        {!isLoading && items.length > 0 && (
          <>
            <div className={effectiveViewMode === "list" ? "cards-grid cards-grid--list" : "cards-grid"}>
              {items.map((item, index) => {
                const marketTag = getMarketTag(item.daysOnSale);
                const primaryMediaUrl = extractMediaUrls(item.yandexDiskUrl)[0];

                return (
                  <Link
                    key={item.id}
                    to={`/showcase/${item.id}`}
                    state={{ fromShowcase: true }}
                    className="vehicle-card vehicle-card-link"
                    style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
                    onClick={() => {
                      if (typeof window === "undefined") {
                        return;
                      }
                      window.sessionStorage.setItem(SHOWCASE_RETURN_FLAG_KEY, "1");
                      window.sessionStorage.setItem(SHOWCASE_SCROLL_Y_KEY, String(window.scrollY));
                    }}
                  >
                    <div className="vehicle-card__image">
                      <span className={marketTag.className}>{marketTag.label}</span>
                      {primaryMediaUrl ? (
                        <>
                          <img
                            src={getMediaPreviewImageUrl(primaryMediaUrl)}
                            alt={item.title || `${item.brand} ${item.model}`}
                            onError={(event) => {
                              const target = event.currentTarget;
                              target.style.display = "none";
                              const fallback = target.nextElementSibling;
                              if (fallback) {
                                (fallback as HTMLElement).style.display = "flex";
                              }
                            }}
                          />
                          <span className="vehicle-card__fallback">
                            <span className="vehicle-card__fallback-icon" aria-hidden>
                              <svg viewBox="0 0 24 24" focusable="false">
                                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                                <circle cx="8.25" cy="10" r="1.5" />
                                <path d="M5.5 16l4.1-4.1a1.2 1.2 0 0 1 1.7 0l1.8 1.8a1.2 1.2 0 0 0 1.7 0l1.7-1.7a1.2 1.2 0 0 1 1.7 0L20.5 14.3" />
                              </svg>
                            </span>
                            <span className="vehicle-card__fallback-text">Нет фотографии</span>
                          </span>
                        </>
                      ) : (
                        <span className="vehicle-card__fallback vehicle-card__fallback--visible">
                          <span className="vehicle-card__fallback-icon" aria-hidden>
                            <svg viewBox="0 0 24 24" focusable="false">
                              <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                              <circle cx="8.25" cy="10" r="1.5" />
                              <path d="M5.5 16l4.1-4.1a1.2 1.2 0 0 1 1.7 0l1.8 1.8a1.2 1.2 0 0 0 1.7 0l1.7-1.7a1.2 1.2 0 0 1 1.7 0L20.5 14.3" />
                            </svg>
                          </span>
                          <span className="vehicle-card__fallback-text">Нет фотографии</span>
                        </span>
                      )}
                    </div>
                    <div className="vehicle-card__content">
                      <h3>{item.title || `${item.brand} ${item.model}`}</h3>
                      <p className="vehicle-card__subtitle">{buildCardSubtitle(item)}</p>
                      <div className="vehicle-card__bottom">
                        <p className="vehicle-card__price">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {isMobileViewport ? (
              <div className="pager pager--compact">
                <button
                  className="pager-button pager-button--nav"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="Предыдущая страница"
                  title="Предыдущая страница"
                >
                  ←
                </button>
                <span className="pager-mobile-status">
                  Стр. {page} из {totalPages}
                </span>
                <button
                  className="pager-button pager-button--nav"
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  aria-label="Следующая страница"
                  title="Следующая страница"
                >
                  →
                </button>
              </div>
            ) : (
              <div className="pager">
                <button
                  className="pager-button pager-button--nav"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="Предыдущая страница"
                  title="Предыдущая страница"
                >
                  ←
                </button>
                <div className="pager-pages">
                  {visiblePages.map((item, index) => {
                    if (item === "ellipsis") {
                      return (
                        <span key={`ellipsis-${index}`} className="pager-ellipsis">
                          ...
                        </span>
                      );
                    }

                    return (
                      <button
                        key={item}
                        type="button"
                        className={item === page ? "pager-page active" : "pager-page"}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="pager-button pager-button--nav"
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  aria-label="Следующая страница"
                  title="Следующая страница"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </section>
  );
}
