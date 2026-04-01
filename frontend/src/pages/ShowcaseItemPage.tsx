import {
  useEffect,
  useMemo,
  useState,
  type ImgHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  addFavoriteItem,
  buildTelegramShareUrl,
  getAdminCatalogItemById,
  getCatalogItemById,
  getFavoriteItemIds,
  getMediaGalleryUrls,
  getMediaPreviewImageUrl,
  logActivityEvent,
  removeFavoriteItem,
  updateAdminCatalogItemComment,
} from "../api/client";
import { renderBookingStatusBadge } from "../catalog/booking-status";
import type { CatalogItem } from "../types/api";

const RESO_TEST_VINS = new Set([
  "LGJ509EZPPR000290",
  "LGJ509EZKRR000360",
  "CLG2000ZAMT047826",
]);

function formatPrice(price: number | null): string {
  if (price === null) {
    return "-";
  }
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

function areSameUrlLists(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
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

function formatBool(value: boolean | null): string {
  if (value === null) {
    return "-";
  }
  return value ? "Да" : "Нет";
}

function formatString(value: string): string {
  const normalized = value.trim();
  return normalized ? normalized : "-";
}

function formatInteger(value: number | null, suffix = ""): string {
  if (value === null) {
    return "-";
  }

  const formatted = value.toLocaleString("ru-RU");
  return suffix ? `${formatted} ${suffix}` : formatted;
}

function renderTextWithLinks(value: string): ReactNode {
  const lines = value.split(/\r?\n/);

  return lines.map((line, lineIndex) => {
    const segments = line.split(/(https?:\/\/[^\s]+)/gi);

    return (
      <span key={`line-${lineIndex}`}>
        {segments.map((segment, segmentIndex) => {
          if (/^https?:\/\//i.test(segment)) {
            return (
              <a
                key={`line-${lineIndex}-segment-${segmentIndex}`}
                href={segment}
                target="_blank"
                rel="noopener noreferrer"
              >
                {segment}
              </a>
            );
          }

          return (
            <span key={`line-${lineIndex}-segment-${segmentIndex}`}>
              {segment}
            </span>
          );
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

interface DetailSpec {
  label: string;
  value: ReactNode;
}

interface ShowcaseItemPageProps {
  allowFavorites?: boolean;
  showTenantInfo?: boolean;
  forcedTenantId?: string;
}

type GalleryResolutionState = "idle" | "loading" | "ready" | "empty" | "error";

function formatTenantLabel(tenantId: string | null | undefined): string {
  if (typeof tenantId !== "string") {
    return "-";
  }

  const normalizedTenantId = tenantId.trim().toLowerCase();
  if (normalizedTenantId === "gpb") {
    return "ГПБ Лизинг";
  }
  if (normalizedTenantId === "reso") {
    return "РЕСО-Лизинг";
  }
  if (normalizedTenantId === "alpha") {
    return "Альфа-Лизинг";
  }
  if (normalizedTenantId === "sovcombank") {
    return "Совкомбанк Лизинг";
  }
  return tenantId.trim() || "-";
}

function normalizeAdminComments(
  comments: string[] | null | undefined,
  legacyComment?: string | null,
): string[] {
  if (Array.isArray(comments)) {
    const normalizedFromArray = comments
      .map((comment) => comment.replace(/\r\n/g, "\n").trim())
      .filter((comment) => comment.length > 0);
    if (normalizedFromArray.length > 0) {
      return normalizedFromArray;
    }
  }

  const normalizedLegacyComment =
    typeof legacyComment === "string"
      ? legacyComment.replace(/\r\n/g, "\n").trim()
      : "";
  return normalizedLegacyComment ? [normalizedLegacyComment] : [];
}

export function ShowcaseItemPage({
  allowFavorites = false,
  showTenantInfo = false,
  forcedTenantId,
}: ShowcaseItemPageProps) {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [galleryResolutionState, setGalleryResolutionState] =
    useState<GalleryResolutionState>("idle");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isThumbnailListExpanded, setIsThumbnailListExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<number>>(new Set());
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const [adminCommentDraft, setAdminCommentDraft] = useState("");
  const [adminCommentStatus, setAdminCommentStatus] = useState<string | null>(null);
  const [isAdminCommentSaving, setIsAdminCommentSaving] = useState(false);

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
        const response = showTenantInfo
          ? await getAdminCatalogItemById(parsedId)
          : await getCatalogItemById(parsedId);

        const normalizedForcedTenant = (forcedTenantId ?? "").trim().toLowerCase();
        const normalizedResponseTenant = (response.tenantId ?? "").trim().toLowerCase();
        if (
          normalizedForcedTenant &&
          (!normalizedResponseTenant || normalizedResponseTenant !== normalizedForcedTenant)
        ) {
          setItem(null);
          setError("Лот недоступен");
          return;
        }

        setItem(response);
      } catch (caughtError) {
        void logActivityEvent({
          eventType: "api_error",
          page: location.pathname,
          entityType: "catalog_item",
          entityId: String(parsedId),
          payload: {
            endpoint: showTenantInfo
              ? `/admin/catalog/items/${parsedId}`
              : `/catalog/items/${parsedId}`,
            message:
              caughtError instanceof Error ? caughtError.message : "unknown_error",
          },
        });

        if (caughtError instanceof Error) {
          if (caughtError.message === "FORBIDDEN") {
            setError("Нет прав для просмотра карточки");
            return;
          }
          setError(caughtError.message);
        } else {
          setError("Не удалось загрузить карточку");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadItem();
  }, [forcedTenantId, itemId, location.pathname, showTenantInfo]);

  useEffect(() => {
    if (!showTenantInfo) {
      setAdminCommentDraft("");
      setAdminCommentStatus(null);
      setIsAdminCommentSaving(false);
      return;
    }

    setAdminCommentDraft("");
    setAdminCommentStatus(null);
    setIsAdminCommentSaving(false);
  }, [showTenantInfo, item?.id]);

  useEffect(() => {
    if (!allowFavorites) {
      setFavoriteItemIds(new Set());
      return;
    }

    let isCancelled = false;
    async function loadFavoriteIds() {
      try {
        const response = await getFavoriteItemIds();
        if (isCancelled) {
          return;
        }
        setFavoriteItemIds(new Set(response.itemIds));
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }
        void logActivityEvent({
          eventType: "api_error",
          page: location.pathname,
          payload: {
            endpoint: "/favorites/ids",
            message:
              caughtError instanceof Error ? caughtError.message : "unknown_error",
          },
        });
      }
    }

    void loadFavoriteIds();
    return () => {
      isCancelled = true;
    };
  }, [allowFavorites, location.pathname]);

  const mediaSourceKeys = useMemo(() => {
    if (!item) {
      return [];
    }

    if (RESO_TEST_VINS.has(item.offerCode)) {
      return [`reso-vin:${item.offerCode}`];
    }

    const rawSource = item.yandexDiskUrl.trim();
    if (rawSource) {
      return [rawSource];
    }

    return [];
  }, [item]);

  useEffect(() => {
    let isCancelled = false;

    async function resolveGallery() {
      if (!mediaSourceKeys.length) {
        setMediaUrls([]);
        setGalleryResolutionState("empty");
        return;
      }

      setGalleryResolutionState("loading");
      setMediaUrls([]);
      setSelectedImage("");
      setIsLightboxOpen(false);

      const primarySource = mediaSourceKeys[0];

      try {
        const galleryUrls = await getMediaGalleryUrls(primarySource);
        if (isCancelled) {
          return;
        }

        if (galleryUrls.length > 0) {
          setMediaUrls((currentUrls) =>
            areSameUrlLists(currentUrls, galleryUrls) ? currentUrls : galleryUrls,
          );
          setGalleryResolutionState("ready");
          return;
        }

        const fallbackUrls = extractMediaUrls(primarySource);
        const shouldUseFallback =
          fallbackUrls.length === 1 && fallbackUrls[0] === primarySource;

        if (shouldUseFallback) {
          setMediaUrls((currentUrls) =>
            areSameUrlLists(currentUrls, fallbackUrls) ? currentUrls : fallbackUrls,
          );
          setGalleryResolutionState("ready");
          return;
        }

        setMediaUrls((currentUrls) => (currentUrls.length > 0 ? [] : currentUrls));
        setGalleryResolutionState("empty");
      } catch (caughtError) {
        void logActivityEvent({
          eventType: "api_error",
          page: location.pathname,
          payload: {
            endpoint: "/media/gallery",
            message:
              caughtError instanceof Error ? caughtError.message : "unknown_error",
          },
        });

        if (!isCancelled) {
          const fallbackUrls = extractMediaUrls(primarySource);
          const shouldUseFallback =
            fallbackUrls.length === 1 && fallbackUrls[0] === primarySource;

          if (shouldUseFallback) {
            setMediaUrls((currentUrls) =>
              areSameUrlLists(currentUrls, fallbackUrls) ? currentUrls : fallbackUrls,
            );
            setGalleryResolutionState("ready");
            return;
          }

          setMediaUrls((currentUrls) => (currentUrls.length > 0 ? [] : currentUrls));
          setGalleryResolutionState("error");
        }
      }
    }

    void resolveGallery();

    return () => {
      isCancelled = true;
    };
  }, [mediaSourceKeys]);

  const selectedImageIndex = selectedImage ? mediaUrls.indexOf(selectedImage) : -1;
  const maxThumbnailCount = 8;
  const hasHiddenThumbnails = mediaUrls.length > maxThumbnailCount;
  const collapsedPreviewCount = maxThumbnailCount - 1;
  const visibleThumbnails = hasHiddenThumbnails
    ? mediaUrls.slice(0, collapsedPreviewCount)
    : mediaUrls;
  const hiddenThumbnailCount = hasHiddenThumbnails
    ? mediaUrls.length - collapsedPreviewCount
    : 0;
  const hiddenThumbnails = hasHiddenThumbnails
    ? isThumbnailListExpanded
      ? mediaUrls.slice(collapsedPreviewCount)
      : []
    : [];
  const isGalleryLoading = galleryResolutionState === "loading";
  const isGalleryError = galleryResolutionState === "error";
  const contactMessage = item
    ? `Добрый день. Вопрос по лоту *${item.offerCode}`
    : "Добрый день. Вопрос по лоту";
  const encodedContactMessage = encodeURIComponent(contactMessage);
  const encodedMailSubject = encodeURIComponent(`Вопрос по лоту ${item?.offerCode ?? ""}`.trim());
  const telegramShareUrl = item ? buildTelegramShareUrl(item.id) : "#";
  const cameFromShowcase = Boolean(
    (location.state as { fromShowcase?: boolean } | null)?.fromShowcase,
  );
  const isFavorite = Boolean(item && favoriteItemIds.has(item.id));
  const savedAdminComments =
    showTenantInfo && item
      ? normalizeAdminComments(item.adminComments, item.adminComment)
      : [];
  const normalizedAdminCommentDraft = adminCommentDraft.trim();
  const hasSavedAdminComments = savedAdminComments.length > 0;

  async function handleAdminCommentSave(): Promise<void> {
    if (!showTenantInfo || !item || isAdminCommentSaving) {
      return;
    }

    if (!normalizedAdminCommentDraft) {
      setAdminCommentStatus(
        hasSavedAdminComments
          ? "Пустой текст не сохраняется. Для удаления используйте кнопку «Удалить комментарии»."
          : "Введите текст комментария перед сохранением.",
      );
      return;
    }

    setIsAdminCommentSaving(true);
    setAdminCommentStatus(null);

    try {
      const response = await updateAdminCatalogItemComment(item.id, adminCommentDraft);
      const normalizedComments = normalizeAdminComments(
        response.adminComments,
        response.adminComment,
      );

      setAdminCommentDraft("");
      setItem((current) => {
        if (!current || current.id !== item.id) {
          return current;
        }

        return {
          ...current,
          adminComment: normalizedComments[0] ?? "",
          adminComments: normalizedComments,
        };
      });
      setAdminCommentStatus("Комментарий добавлен");
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message === "FORBIDDEN") {
        setAdminCommentStatus("Нет прав для сохранения комментария");
      } else {
        setAdminCommentStatus("Не удалось сохранить комментарий");
      }
    } finally {
      setIsAdminCommentSaving(false);
    }
  }

  async function handleAdminCommentDelete(): Promise<void> {
    if (!showTenantInfo || !item || isAdminCommentSaving || !hasSavedAdminComments) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("Удалить все внутренние комментарии по этому лоту?")
    ) {
      return;
    }

    setIsAdminCommentSaving(true);
    setAdminCommentStatus(null);

    try {
      await updateAdminCatalogItemComment(item.id, "");
      setAdminCommentDraft("");
      setItem((current) => {
        if (!current || current.id !== item.id) {
          return current;
        }

        return {
          ...current,
          adminComment: "",
          adminComments: [],
        };
      });
      setAdminCommentStatus("Комментарии удалены");
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message === "FORBIDDEN") {
        setAdminCommentStatus("Нет прав для удаления комментария");
      } else {
        setAdminCommentStatus("Не удалось удалить комментарий");
      }
    } finally {
      setIsAdminCommentSaving(false);
    }
  }

  async function handleFavoriteToggle(
    event: MouseEvent<HTMLButtonElement>,
  ): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (!allowFavorites || !item || isFavoritePending) {
      return;
    }

    const currentFavorite = favoriteItemIds.has(item.id);
    setIsFavoritePending(true);
    setFavoriteItemIds((current) => {
      const next = new Set(current);
      if (currentFavorite) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });

    try {
      if (currentFavorite) {
        await removeFavoriteItem(item.id);
      } else {
        await addFavoriteItem(item.id);
      }
    } catch {
      setFavoriteItemIds((current) => {
        const next = new Set(current);
        if (currentFavorite) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
        return next;
      });
      setError("Не удалось обновить избранное");
    } finally {
      setIsFavoritePending(false);
    }
  }

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

  useEffect(() => {
    setIsThumbnailListExpanded(false);
  }, [itemId]);

  useEffect(() => {
    setIsFavoritePending(false);
  }, [itemId]);

  function openLightbox(
    url: string,
    source: "main_image" | "thumbnail" | "hidden_thumbnails" | "unknown" = "unknown",
  ): void {
    if (!url) {
      return;
    }

    const imageIndex = mediaUrls.indexOf(url);
    if (item) {
      void logActivityEvent({
        eventType: "showcase_gallery_open",
        page: location.pathname,
        entityType: "catalog_item",
        entityId: String(item.id),
        payload: {
          source,
          imageIndex: imageIndex >= 0 ? imageIndex : 0,
          totalImages: mediaUrls.length,
        },
      });
    }

    setSelectedImage(url);
    setIsLightboxOpen(true);
  }

  function closeLightbox(reason: string = "manual"): void {
    if (!isLightboxOpen) {
      return;
    }

    if (item) {
      void logActivityEvent({
        eventType: "showcase_gallery_close",
        page: location.pathname,
        entityType: "catalog_item",
        entityId: String(item.id),
        payload: {
          reason,
          imageIndex: selectedImageIndex >= 0 ? selectedImageIndex : 0,
          totalImages: mediaUrls.length,
        },
      });
    }

    setIsLightboxOpen(false);
  }

  function showPreviousImage(): void {
    if (!mediaUrls.length) {
      return;
    }

    const currentIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
    const previousIndex = currentIndex === 0 ? mediaUrls.length - 1 : currentIndex - 1;
    if (item) {
      void logActivityEvent({
        eventType: "showcase_gallery_navigate",
        page: location.pathname,
        entityType: "catalog_item",
        entityId: String(item.id),
        payload: {
          direction: "previous",
          fromIndex: currentIndex,
          toIndex: previousIndex,
          totalImages: mediaUrls.length,
        },
      });
    }
    setSelectedImage(mediaUrls[previousIndex]);
  }

  function showNextImage(): void {
    if (!mediaUrls.length) {
      return;
    }

    const currentIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
    const nextIndex = currentIndex === mediaUrls.length - 1 ? 0 : currentIndex + 1;
    if (item) {
      void logActivityEvent({
        eventType: "showcase_gallery_navigate",
        page: location.pathname,
        entityType: "catalog_item",
        entityId: String(item.id),
        payload: {
          direction: "next",
          fromIndex: currentIndex,
          toIndex: nextIndex,
          totalImages: mediaUrls.length,
        },
      });
    }
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
        closeLightbox("escape_key");
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
      <Link
        className="detail-back-link"
        to="/showcase"
        onClick={(event) => {
          if (!cameFromShowcase) {
            return;
          }

          event.preventDefault();
          navigate(-1);
        }}
      >
        Назад к витрине
      </Link>

      {error && <p className="error">{error}</p>}
      {isLoading && <p>Загрузка карточки...</p>}

      {!isLoading && !error && item && (
        <>
          <div className="detail-top-cards">
            <article className="detail-trust-card">
              <div className="detail-trust-content">
                <p className="detail-trust-title">{item.title || `${item.brand} ${item.model}`}</p>
                <p className="detail-trust-meta">
                  {formatDate(item.createdAt) || "Дата не указана"} · Код {formatString(item.offerCode)}
                </p>
              </div>
              <div className="detail-trust-price-wrap">
                <p className="detail-trust-price">{formatPrice(item.price)}</p>
                {allowFavorites && (
                  <button
                    type="button"
                    className={
                      isFavorite
                        ? "detail-favorite-button detail-favorite-button--active"
                        : "detail-favorite-button"
                    }
                    onClick={(event) => {
                      void handleFavoriteToggle(event);
                    }}
                    disabled={isFavoritePending}
                    aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                    title={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                  >
                    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                      <path d="M12 2.8l2.86 5.79 6.39.93-4.63 4.52 1.09 6.37L12 17.48 6.29 20.4l1.09-6.37L2.75 9.52l6.39-.93L12 2.8z" />
                    </svg>
                    <span>{isFavorite ? "В избранном" : "В избранное"}</span>
                  </button>
                )}
              </div>
            </article>

            <aside className="detail-cta-card">
              <p className="detail-cta-caption">Нужна дополнительная информация по лоту?</p>
              <a
                className="detail-cta-button detail-cta-button--share"
                href={telegramShareUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (!item) {
                    return;
                  }

                  void logActivityEvent({
                    eventType: "showcase_contact_click",
                    page: location.pathname,
                    entityType: "catalog_item",
                    entityId: String(item.id),
                    payload: {
                      channel: "telegram_share",
                    },
                  });
                }}
              >
                <span className="detail-cta-button__icon" aria-hidden>
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9.8 14.7l-.4 4.1c.6 0 .9-.3 1.2-.6l2.9-2.8 6-4.4c1-.7-.2-1.1-1.5-.6l-7.4 2.8-3.2-1c-1.3-.4-1.3-1.3.3-1.9l12.6-4.9c1.2-.4 2.2.3 1.8 1.9l-2.1 10.3c-.3 1.3-1.1 1.7-2.2 1.1l-6-4.4-2.9 2.8c-.3.3-.6.6-1.1.6z" />
                  </svg>
                </span>
                <span className="detail-cta-button__text">Поделиться в Telegram</span>
              </a>
              <a
                className="detail-cta-button"
                href={`mailto:romanodokienko@gmail.com?subject=${encodedMailSubject}&body=${encodedContactMessage}`}
                target="_blank"
                rel="noreferrer"
                title="romanodokienko@gmail.com"
                onClick={() => {
                  if (!item) {
                    return;
                  }

                  void logActivityEvent({
                    eventType: "showcase_contact_click",
                    page: location.pathname,
                    entityType: "catalog_item",
                    entityId: String(item.id),
                    payload: {
                      channel: "email",
                    },
                  });
                }}
              >
                Написать на почту
              </a>
              <a
                className="detail-cta-button detail-cta-button--telegram"
                href={`https://t.me/romanodokienko?text=${encodedContactMessage}`}
                target="_blank"
                rel="noreferrer"
                title="@romanodokienko"
                onClick={() => {
                  if (!item) {
                    return;
                  }

                  void logActivityEvent({
                    eventType: "showcase_contact_click",
                    page: location.pathname,
                    entityType: "catalog_item",
                    entityId: String(item.id),
                    payload: {
                      channel: "telegram",
                    },
                  });
                }}
              >
                <span className="detail-cta-button__icon" aria-hidden>
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9.8 14.7l-.4 4.1c.6 0 .9-.3 1.2-.6l2.9-2.8 6-4.4c1-.7-.2-1.1-1.5-.6l-7.4 2.8-3.2-1c-1.3-.4-1.3-1.3.3-1.9l12.6-4.9c1.2-.4 2.2.3 1.8 1.9l-2.1 10.3c-.3 1.3-1.1 1.7-2.2 1.1l-6-4.4-2.9 2.8c-.3.3-.6.6-1.1.6z" />
                  </svg>
                </span>
                <span className="detail-cta-button__text">Написать в Telegram</span>
              </a>
            </aside>
          </div>

          <div className="detail-layout">
            <aside className="panel detail-side-panel">
              {(() => {
                const ownershipSpecs: DetailSpec[] = [
                  ...(showTenantInfo
                    ? [
                        {
                          label: "Лизингодатель",
                          value: formatTenantLabel(item.tenantId),
                        },
                        {
                          label: "Ответственный",
                          value: formatString(item.responsiblePerson),
                        },
                        {
                          label: "Дней в продаже",
                          value: formatInteger(item.daysOnSale),
                        },
                      ]
                    : []),
                  { label: "Год выпуска", value: formatInteger(item.year) },
                  { label: "Пробег", value: formatInteger(item.mileageKm, "км") },
                  {
                    label: "Статус брони",
                    value: showTenantInfo
                      ? renderBookingStatusBadge(item.bookingStatus, "Без статуса")
                      : formatString(item.bookingStatus || "Без статуса"),
                  },
                  { label: "Регион/адрес", value: formatString(item.storageAddress) },
                ];

                const technicalSpecs: DetailSpec[] = [
                  { label: "Марка", value: formatString(item.brand) },
                  { label: "Модель", value: formatString(item.model) },
                  { label: "Модификация", value: formatString(item.modification) },
                  { label: "Тип ТС", value: formatString(item.vehicleType) },
                  { label: "ПТС/ЭПТС", value: formatString(item.ptsType) },
                  { label: "Ключи", value: formatInteger(item.keyCount) },
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

              {showTenantInfo && (
                <section className="detail-admin-note">
                  <h3>Внутренний комментарий</h3>
                  <textarea
                    value={adminCommentDraft}
                    maxLength={5000}
                    placeholder="Введите комментарий. Можно вставлять ссылки."
                    onChange={(event) => {
                      setAdminCommentDraft(event.target.value);
                      setAdminCommentStatus(null);
                    }}
                  />
                  <div className="detail-admin-note__actions">
                    <div className="detail-admin-note__buttons">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={isAdminCommentSaving || !normalizedAdminCommentDraft}
                        onClick={() => {
                          void handleAdminCommentSave();
                        }}
                      >
                        {isAdminCommentSaving ? "Сохраняю..." : "Сохранить комментарий"}
                      </button>
                      {hasSavedAdminComments && (
                        <button
                          type="button"
                          className="secondary-button detail-admin-note__delete"
                          disabled={isAdminCommentSaving}
                          onClick={() => {
                            void handleAdminCommentDelete();
                          }}
                        >
                          Удалить комментарии
                        </button>
                      )}
                    </div>
                    <span className="detail-admin-note__counter">
                      {adminCommentDraft.length}/5000
                    </span>
                  </div>
                  {adminCommentStatus && (
                    <p className="detail-admin-note__status">{adminCommentStatus}</p>
                  )}
                  <div className="detail-admin-note__saved">
                    <p className="detail-admin-note__saved-label">Сохраненные комментарии:</p>
                    {hasSavedAdminComments ? (
                      <ol className="detail-admin-note__saved-list">
                        {savedAdminComments.map((comment, index) => (
                          <li
                            key={`saved-admin-comment-${index}-${comment.slice(0, 32)}`}
                            className="detail-admin-note__saved-item"
                          >
                            {renderTextWithLinks(comment)}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="detail-admin-note__saved-empty">
                        Комментарий пока не добавлен.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {item.websiteUrl && (
                <a
                  className="detail-external-link"
                  href={item.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    void logActivityEvent({
                      eventType: "showcase_source_open",
                      page: location.pathname,
                      entityType: "catalog_item",
                      entityId: String(item.id),
                    });
                  }}
                >
                  Открыть источник лота
                </a>
              )}
            </aside>

            <section className="panel detail-gallery-panel">
              <div className="detail-main-image">
                {isGalleryLoading ? (
                  <div className="detail-image-loading" role="status" aria-live="polite">
                    <span className="detail-image-loading__spinner" aria-hidden />
                    <span>Загружаем фото...</span>
                  </div>
                ) : selectedImage ? (
                  <>
                    <button
                      type="button"
                      className="detail-main-image__link"
                      onClick={() => {
                        if (isLightboxOpen) {
                          closeLightbox("main_image_toggle");
                        } else {
                          openLightbox(selectedImage, "main_image");
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
                  <div className="detail-no-image">
                    {isGalleryError ? "Не удалось загрузить фото" : "Фото отсутствует"}
                  </div>
                )}
              </div>

              {mediaUrls.length > 1 && (
                <div
                  id="detail-hidden-thumbnails"
                  className={
                    isThumbnailListExpanded
                      ? "detail-thumbnails detail-thumbnails--expanded"
                      : "detail-thumbnails"
                  }
                >
                  {visibleThumbnails.map((url, index) => (
                    <button
                      type="button"
                      key={url}
                      className={url === selectedImage ? "detail-thumb active" : "detail-thumb"}
                      onClick={() => openLightbox(url, "thumbnail")}
                      aria-label={`Фото ${index + 1}`}
                      title="Открыть полноэкранный просмотр"
                    >
                      <ProxyAwareImage sourceUrl={url} alt="Миниатюра" />
                    </button>
                  ))}
                  {hasHiddenThumbnails && (
                    <button
                      type="button"
                      className="detail-thumb detail-thumb--more-button"
                      onClick={() => {
                        setIsThumbnailListExpanded((currentValue) => !currentValue);
                      }}
                      aria-expanded={isThumbnailListExpanded}
                      aria-controls="detail-hidden-thumbnails"
                      aria-label={
                        isThumbnailListExpanded
                          ? "Свернуть список фото"
                          : `Показать еще ${hiddenThumbnailCount} фото`
                      }
                      title={
                        isThumbnailListExpanded
                          ? "Свернуть список фото"
                          : `Показать еще ${hiddenThumbnailCount} фото`
                      }
                    >
                      <span className="detail-thumb__more detail-thumb__more--static">
                        {isThumbnailListExpanded ? "Свернуть" : `+${hiddenThumbnailCount} фото`}
                      </span>
                    </button>
                  )}
                  {hiddenThumbnails.map((url, index) => (
                    <button
                      type="button"
                      key={`${url}-${index}`}
                      className={url === selectedImage ? "detail-thumb active" : "detail-thumb"}
                      onClick={() => openLightbox(url, "hidden_thumbnails")}
                      aria-label={`Фото ${collapsedPreviewCount + index + 1}`}
                      title="Открыть полноэкранный просмотр"
                    >
                      <ProxyAwareImage
                        sourceUrl={url}
                        alt="Миниатюра"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
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
              onClick={() => closeLightbox("backdrop")}
            >
              <button
                type="button"
                className="detail-lightbox__close"
                onClick={(event) => {
                  event.stopPropagation();
                  closeLightbox("close_button");
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
                  onClick={() => closeLightbox("image_click")}
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



