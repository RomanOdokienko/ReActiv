import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  getFavoriteItems,
  getMediaPreviewImageUrl,
  removeFavoriteItem,
} from "../api/client";
import type { CatalogListItem, FavoriteItemsResponse } from "../types/api";

const FAVORITES_PAGE_SIZE = 20;

function formatPrice(price: number | null): string {
  if (price === null) {
    return "—";
  }
  return `${price.toLocaleString("ru-RU")} ₽`;
}

function buildCardSubtitle(item: CatalogListItem): string {
  const yearPart = item.year !== null ? `${item.year} г` : "";
  const mileagePart =
    item.mileageKm !== null ? `${item.mileageKm.toLocaleString("ru-RU")} км` : "";
  return [yearPart, mileagePart].filter(Boolean).join(", ");
}

export function FavoritesPage() {
  const [itemsResponse, setItemsResponse] = useState<FavoriteItemsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<Set<number>>(new Set());

  const loadFavorites = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getFavoriteItems(targetPage, FAVORITES_PAGE_SIZE);
      setItemsResponse(response);

      const totalPages = Math.max(
        1,
        Math.ceil(response.pagination.total / response.pagination.pageSize),
      );
      if (targetPage > totalPages && response.pagination.total > 0) {
        setPage(totalPages);
      }
    } catch {
      setError("Не удалось загрузить избранное");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites(page);
  }, [loadFavorites, page]);

  const items = itemsResponse?.items ?? [];
  const total = itemsResponse?.pagination.total ?? 0;
  const totalPages = useMemo(() => {
    const pageSize = itemsResponse?.pagination.pageSize ?? FAVORITES_PAGE_SIZE;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [itemsResponse?.pagination.pageSize, total]);

  async function handleRemoveFavorite(
    event: MouseEvent<HTMLButtonElement>,
    itemId: number,
  ): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (pendingItemIds.has(itemId)) {
      return;
    }

    setPendingItemIds((current) => new Set(current).add(itemId));
    try {
      await removeFavoriteItem(itemId);
      await loadFavorites(page);
    } catch {
      setError("Не удалось обновить избранное");
    } finally {
      setPendingItemIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
    }
  }

  return (
    <section className="favorites-page">
      <h1>Избранное</h1>
      {error && <p className="error">{error}</p>}

      {!isLoading && total > 0 && (
        <p className="favorites-page__meta">
          Сохранено {total.toLocaleString("ru-RU")} позиций
        </p>
      )}

      {isLoading && <p>Загрузка избранного...</p>}

      {!isLoading && total === 0 && (
        <p className="empty">Пока нет избранных позиций.</p>
      )}

      {!isLoading && items.length > 0 && (
        <>
          <div className="cards-grid">
            {items.map((item, index) => {
              const isPending = pendingItemIds.has(item.id);

              return (
                <Link
                  key={item.id}
                  to={`/showcase/${item.id}`}
                  className="vehicle-card vehicle-card-link"
                  style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
                >
                  <div className="vehicle-card__image">
                    {item.previewUrl ? (
                      <>
                        <img
                          src={getMediaPreviewImageUrl(item.previewUrl, { width: 360 })}
                          alt={item.title || `${item.brand} ${item.model}`}
                          loading={index < 4 ? "eager" : "lazy"}
                          decoding="async"
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
                          <span className="vehicle-card__fallback-text">
                            Фото пока нет. Но они скоро появятся
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="vehicle-card__fallback vehicle-card__fallback--visible">
                        <span className="vehicle-card__fallback-text">
                          Фото пока нет. Но они скоро появятся
                        </span>
                      </span>
                    )}

                    <button
                      type="button"
                      className="vehicle-card__favorite-button vehicle-card__favorite-button--active"
                      onClick={(event) => {
                        void handleRemoveFavorite(event, item.id);
                      }}
                      disabled={isPending}
                      aria-label="Убрать из избранного"
                      title="Убрать из избранного"
                    >
                      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                        <path d="M12 2.8l2.86 5.79 6.39.93-4.63 4.52 1.09 6.37L12 17.48 6.29 20.4l1.09-6.37L2.75 9.52l6.39-.93L12 2.8z" />
                      </svg>
                    </button>
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

          {totalPages > 1 && (
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
          )}
        </>
      )}
    </section>
  );
}
