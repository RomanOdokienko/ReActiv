import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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

export function ShowcasePage() {
  const pageSize = 20;

  const [filters, setFilters] = useState<CatalogFiltersResponse | null>(null);
  const [itemsResponse, setItemsResponse] = useState<CatalogItemsResponse | null>(
    null,
  );
  const [bookingPreset, setBookingPreset] = useState<"" | BookingPreset>("");
  const [city, setCity] = useState("");
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [mileageMin, setMileageMin] = useState("");
  const [mileageMax, setMileageMax] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const items: CatalogItem[] = itemsResponse?.items ?? [];
  const total = itemsResponse?.pagination.total ?? 0;
  const hasImportedData = total > 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const vehicleTypeOptions = filters?.vehicleType ?? [];

  useEffect(() => {
    if (vehicleTypeOptions.length === 0) {
      return;
    }

    setSelectedVehicleTypes((current) =>
      current.filter((value) => vehicleTypeOptions.includes(value)),
    );
  }, [vehicleTypeOptions]);

  const availableModels = useMemo(() => {
    if (!filters) {
      return [];
    }

    if (!brand) {
      return filters.model;
    }

    return filters.modelsByBrand?.[brand] ?? [];
  }, [brand, filters]);

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

  const sortSelection = useMemo(() => {
    if (sortBy === "price") {
      return sortDir === "asc" ? "price_asc" : "price_desc";
    }

    return sortDir === "asc" ? "created_at_asc" : "created_at_desc";
  }, [sortBy, sortDir]);

  function applySortSelection(value: string): void {
    setPage(1);

    if (value === "price_asc") {
      setSortBy("price");
      setSortDir("asc");
      return;
    }

    if (value === "price_desc") {
      setSortBy("price");
      setSortDir("desc");
      return;
    }

    if (value === "created_at_asc") {
      setSortBy("created_at");
      setSortDir("asc");
      return;
    }

    setSortBy("created_at");
    setSortDir("desc");
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
        <div className="showcase-filter-panel">
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

          <div className="showcase-filter-grid showcase-filter-grid--type">
            <div className="vehicle-type-picker">
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
              onChange={(event) => {
                setPage(1);
                const nextBrand = event.target.value;
                setBrand(nextBrand);

                const nextModels = nextBrand
                  ? filters?.modelsByBrand?.[nextBrand] ?? []
                  : filters?.model ?? [];
                if (model && !nextModels.includes(model)) {
                  setModel("");
                }
              }}
            >
              <option value="">Марка</option>
              {(filters?.brand ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              className={`${model ? "showcase-filter is-active" : "showcase-filter"} showcase-filter--select`}
              value={model}
              disabled={brand !== "" && availableModels.length === 0}
              onChange={(event) => {
                setPage(1);
                setModel(event.target.value);
              }}
            >
              <option value="">
                {brand !== "" && availableModels.length === 0
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

          <div className="showcase-filter-actions">
            <button type="button" className="secondary-button" onClick={clearFilters}>
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="showcase-meta">
          <strong>Найдено {total.toLocaleString("ru-RU")} позиций</strong>
          <div className="showcase-meta-controls">
            <div className="showcase-sort">
              <select
                className="showcase-filter showcase-filter--select showcase-sort-select"
                value={sortSelection}
                onChange={(event) => applySortSelection(event.target.value)}
                aria-label="Сортировка"
              >
                <option value="created_at_desc">Сначала новые</option>
                <option value="created_at_asc">Сначала старые</option>
                <option value="price_asc">Сначала дешевле</option>
                <option value="price_desc">Сначала дороже</option>
              </select>
            </div>

            <div className="view-switch showcase-view-switch">
              <button
                type="button"
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
              >
                Сетка
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
              >
                По порядку
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
            <div className={viewMode === "list" ? "cards-grid cards-grid--list" : "cards-grid"}>
              {items.map((item, index) => {
                const marketTag = getMarketTag(item.daysOnSale);
                const primaryMediaUrl = extractMediaUrls(item.yandexDiskUrl)[0];

                return (
                  <Link
                    key={item.id}
                    to={`/showcase/${item.id}`}
                    className="vehicle-card vehicle-card-link"
                    style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
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
          </>
        )}
      </main>
    </section>
  );
}
