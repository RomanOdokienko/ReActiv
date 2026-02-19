import {
  useEffect,
  useMemo,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  getCatalogItemById,
  getMediaGalleryUrls,
  getMediaPreviewImageUrl,
} from "../api/client";
import type { CatalogItem } from "../types/api";

function formatPrice(price: number): string {
  return `${price.toLocaleString("ru-RU")} ₽`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function getDisplayImageUrl(url: string): string {
  return getMediaPreviewImageUrl(url);
}

type ProxyAwareImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  sourceUrl: string;
};

function ProxyAwareImage({ sourceUrl, onError, ...restProps }: ProxyAwareImageProps) {
  const [useDirectUrl, setUseDirectUrl] = useState(false);

  useEffect(() => {
    setUseDirectUrl(false);
  }, [sourceUrl]);

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>): void {
    if (!useDirectUrl) {
      setUseDirectUrl(true);
      return;
    }

    if (onError) {
      onError(event);
    }
  }

  return (
    <img
      {...restProps}
      src={useDirectUrl ? sourceUrl : getDisplayImageUrl(sourceUrl)}
      onError={handleError}
    />
  );
}

function formatBool(value: boolean): string {
  return value ? "Да" : "Нет";
}

function formatString(value: string): string {
  const normalized = value.trim();
  return normalized ? normalized : "-";
}

interface DetailSpec {
  label: string;
  value: string;
}

function getMarketTag(daysOnSale: number): { label: string; tone: "market" | "good" | "bad" } {
  if (daysOnSale <= 30) {
    return { label: "цена в рынке", tone: "market" };
  }
  if (daysOnSale <= 90) {
    return { label: "ниже рынка", tone: "good" };
  }
  return { label: "выше рынка", tone: "bad" };
}

export function ShowcaseItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadItem() {
      const parsedId = Number(itemId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        setError("Некорректный идентификатор карточки");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await getCatalogItemById(parsedId);
        setItem(response);
      } catch (caughtError) {
        if (caughtError instanceof Error) {
          setError(caughtError.message);
        } else {
          setError("Не удалось загрузить карточку");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadItem();
  }, [itemId]);

  const sourceUrls = useMemo(() => {
    if (!item) {
      return [];
    }

    return extractMediaUrls(item.yandexDiskUrl);
  }, [item]);

  useEffect(() => {
    let isCancelled = false;

    async function resolveGallery() {
      if (!sourceUrls.length) {
        setMediaUrls([]);
        return;
      }

      if (sourceUrls.length > 1) {
        setMediaUrls(sourceUrls);
        return;
      }

      try {
        const galleryUrls = await getMediaGalleryUrls(sourceUrls[0]);
        if (isCancelled) {
          return;
        }

        if (galleryUrls.length > 0) {
          setMediaUrls(galleryUrls);
          return;
        }

        setMediaUrls(sourceUrls);
      } catch {
        if (!isCancelled) {
          setMediaUrls(sourceUrls);
        }
      }
    }

    void resolveGallery();

    return () => {
      isCancelled = true;
    };
  }, [sourceUrls]);

  const selectedImageIndex = selectedImage ? mediaUrls.indexOf(selectedImage) : -1;
  const maxThumbnailCount = 8;
  const hasHiddenThumbnails = mediaUrls.length > maxThumbnailCount;
  const visibleThumbnails = hasHiddenThumbnails
    ? mediaUrls.slice(0, maxThumbnailCount - 1)
    : mediaUrls;
  const hiddenThumbnailCount = hasHiddenThumbnails
    ? mediaUrls.length - visibleThumbnails.length
    : 0;
  const firstHiddenThumbnailUrl = hasHiddenThumbnails
    ? mediaUrls[visibleThumbnails.length]
    : null;
  const marketTag = item ? getMarketTag(item.daysOnSale) : null;

  useEffect(() => {
    if (!mediaUrls.length) {
      setSelectedImage("");
      setIsLightboxOpen(false);
      return;
    }

    if (!selectedImage || !mediaUrls.includes(selectedImage)) {
      setSelectedImage(mediaUrls[0]);
    }
  }, [mediaUrls, selectedImage]);

  function openLightbox(url: string): void {
    if (!url) {
      return;
    }

    setSelectedImage(url);
    setIsLightboxOpen(true);
  }

  function closeLightbox(): void {
    setIsLightboxOpen(false);
  }

  function showPreviousImage(): void {
    if (!mediaUrls.length) {
      return;
    }

    const currentIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
    const previousIndex = currentIndex === 0 ? mediaUrls.length - 1 : currentIndex - 1;
    setSelectedImage(mediaUrls[previousIndex]);
  }

  function showNextImage(): void {
    if (!mediaUrls.length) {
      return;
    }

    const currentIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
    const nextIndex = currentIndex === mediaUrls.length - 1 ? 0 : currentIndex + 1;
    setSelectedImage(mediaUrls[nextIndex]);
  }

  useEffect(() => {
    if (!isLightboxOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        closeLightbox();
        return;
      }

      if (mediaUrls.length <= 1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousImage();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLightboxOpen, mediaUrls.length, selectedImageIndex]);

  return (
    <section className="showcase-detail-page">
      <Link className="detail-back-link" to="/showcase">
        Назад к витрине
      </Link>

      {error && <p className="error">{error}</p>}
      {isLoading && <p>Загрузка карточки...</p>}

      {!isLoading && !error && item && (
        <>
          <header className="detail-header">
            <div>
              <h1>{item.title || `${item.brand} ${item.model}`}</h1>
              <p className="detail-meta-line">
                {formatDate(item.createdAt) || "Дата не указана"} · Код {item.offerCode}
              </p>
            </div>
            <div className="detail-header-price-wrap">
              {marketTag && (
                <span className={`detail-market-tag detail-market-tag--${marketTag.tone}`}>
                  {marketTag.label}
                </span>
              )}
              <p className="detail-header-price">{formatPrice(item.price)}</p>
            </div>
          </header>

          <div className="detail-top-cards">
            <article className="detail-trust-card">
              <span className="detail-trust-icon" aria-hidden>
                ✓
              </span>
              <div className="detail-trust-content">
                <p className="detail-trust-title">
                  {item.responsiblePerson
                    ? `Ответственный: ${item.responsiblePerson}`
                    : "Проверенный лот"}
                </p>
                <p className="detail-trust-meta">
                  {formatString(item.storageAddress) !== "-"
                    ? item.storageAddress
                    : "Адрес хранения уточняется"}
                </p>
              </div>
            </article>

            <aside className="detail-cta-card">
              <p className="detail-cta-caption">Нужна дополнительная информация по лоту?</p>
              {item.websiteUrl ? (
                <a
                  className="detail-cta-button"
                  href={item.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть карточку источника
                </a>
              ) : (
                <a
                  className="detail-cta-button"
                  href="https://t.me/romanodokienko"
                  target="_blank"
                  rel="noreferrer"
                >
                  Прямой контакт
                </a>
              )}
            </aside>
          </div>

          <div className="detail-layout">
            <aside className="panel detail-side-panel">
              {(() => {
                const ownershipSpecs: DetailSpec[] = [
                  { label: "Год выпуска", value: String(item.year) },
                  { label: "Пробег", value: `${item.mileageKm.toLocaleString("ru-RU")} км` },
                  {
                    label: "Статус брони",
                    value: formatString(item.bookingStatus || "Без статуса"),
                  },
                  { label: "Ответственный", value: formatString(item.responsiblePerson) },
                  { label: "Дней в продаже", value: `${item.daysOnSale}` },
                  { label: "Регион/адрес", value: formatString(item.storageAddress) },
                ];

                const technicalSpecs: DetailSpec[] = [
                  { label: "Марка", value: formatString(item.brand) },
                  { label: "Модель", value: formatString(item.model) },
                  { label: "Модификация", value: formatString(item.modification) },
                  { label: "Тип ТС", value: formatString(item.vehicleType) },
                  { label: "ПТС/ЭПТС", value: formatString(item.ptsType) },
                  { label: "Ключи", value: `${item.keyCount}` },
                  { label: "Обременение", value: formatBool(item.hasEncumbrance) },
                  { label: "Снят с учета", value: formatBool(item.isDeregistered) },
                ];

                return (
                  <>
                    <section className="detail-section">
                      <h3>Общие данные</h3>
                      <dl className="detail-spec-list">
                        {ownershipSpecs.map((spec) => (
                          <div className="detail-spec-row" key={spec.label}>
                            <dt>{spec.label}</dt>
                            <dd>{spec.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>

                    <section className="detail-section">
                      <h3>Характеристики</h3>
                      <dl className="detail-spec-list">
                        {technicalSpecs.map((spec) => (
                          <div className="detail-spec-row" key={spec.label}>
                            <dt>{spec.label}</dt>
                            <dd>{spec.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  </>
                );
              })()}

              {item.websiteUrl && (
                <a
                  className="detail-external-link"
                  href={item.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть источник лота
                </a>
              )}
            </aside>

            <section className="panel detail-gallery-panel">
              <div className="detail-main-image">
                {selectedImage ? (
                  <>
                    <button
                      type="button"
                      className="detail-main-image__link"
                      onClick={() => {
                        if (isLightboxOpen) {
                          closeLightbox();
                        } else {
                          openLightbox(selectedImage);
                        }
                      }}
                      title="Открыть полноэкранный просмотр"
                      aria-label="Открыть полноэкранный просмотр"
                    >
                      <ProxyAwareImage
                        sourceUrl={selectedImage}
                        alt={item.title || `${item.brand} ${item.model}`}
                      />
                    </button>
                    <div className="detail-main-image__overlay">
                      <span className="detail-main-chip detail-main-chip--hd">HD</span>
                      <span className="detail-main-chip">
                        Фото {selectedImageIndex >= 0 ? selectedImageIndex + 1 : 1}/{mediaUrls.length}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="detail-no-image">Фото отсутствует</div>
                )}
              </div>

              {mediaUrls.length > 1 && (
                <div className="detail-thumbnails">
                  {visibleThumbnails.map((url, index) => (
                    <button
                      type="button"
                      key={url}
                      className={url === selectedImage ? "detail-thumb active" : "detail-thumb"}
                      onClick={() => openLightbox(url)}
                      aria-label={`Фото ${index + 1}`}
                      title="Открыть полноэкранный просмотр"
                    >
                      <ProxyAwareImage sourceUrl={url} alt="Миниатюра" />
                    </button>
                  ))}
                  {hasHiddenThumbnails && firstHiddenThumbnailUrl && (
                    <button
                      type="button"
                      className="detail-thumb detail-thumb--more-button"
                      onClick={() => openLightbox(firstHiddenThumbnailUrl)}
                      aria-label={`Показать еще ${hiddenThumbnailCount} фото`}
                      title={`Показать еще ${hiddenThumbnailCount} фото`}
                    >
                      <span className="detail-thumb__more detail-thumb__more--static">
                        +{hiddenThumbnailCount} фото
                      </span>
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>

          {isLightboxOpen && selectedImage && (
            <div
              className="detail-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Полноэкранный просмотр фото"
              onClick={closeLightbox}
            >
              <button
                type="button"
                className="detail-lightbox__close"
                onClick={(event) => {
                  event.stopPropagation();
                  closeLightbox();
                }}
                aria-label="Закрыть просмотр"
              >
                ×
              </button>

              {mediaUrls.length > 1 && (
                <button
                  type="button"
                  className="detail-lightbox__nav detail-lightbox__nav--prev"
                  onClick={(event) => {
                    event.stopPropagation();
                    showPreviousImage();
                  }}
                  aria-label="Предыдущее фото"
                >
                  ‹
                </button>
              )}

              <div className="detail-lightbox__body" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="detail-lightbox__image-button"
                  onClick={closeLightbox}
                  aria-label="Закрыть просмотр"
                >
                  <ProxyAwareImage
                    className="detail-lightbox__image"
                    sourceUrl={selectedImage}
                    alt={item.title || `${item.brand} ${item.model}`}
                  />
                </button>
                <p className="detail-lightbox__counter">
                  Фото {selectedImageIndex >= 0 ? selectedImageIndex + 1 : 1}/{mediaUrls.length}
                </p>
              </div>

              {mediaUrls.length > 1 && (
                <button
                  type="button"
                  className="detail-lightbox__nav detail-lightbox__nav--next"
                  onClick={(event) => {
                    event.stopPropagation();
                    showNextImage();
                  }}
                  aria-label="Следующее фото"
                >
                  ›
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
