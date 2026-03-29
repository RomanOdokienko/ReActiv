import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCatalogItems,
  getMediaPreviewImageUrl,
  logActivityEvent,
} from "../api/client";
import { PASSENGER_BRAND_PAGES } from "../content/passenger-brand-pages";
import { TRUCK_BRAND_PAGES } from "../content/truck-brand-pages";
import type { CatalogListItem } from "../types/api";

const PREPOSITION_NBSP_PATTERN =
  /(^|[\s([{'"«„-])(а|без|в|во|для|до|за|и|из|к|ко|на|над|не|ни|о|об|обо|от|по|под|при|про|с|со|у)\s+/giu;

interface LandingCatalogState {
  featuredItems: CatalogListItem[];
}

interface FaqItem {
  question: string;
  answer: string;
}

interface AudienceCard {
  title: string;
  text: string;
}

interface BenefitCard {
  title: string;
  text: string;
  iconSrc: string;
}

interface FeaturedBrandTarget {
  name: string;
  query: string;
}

const BENEFIT_CARDS: BenefitCard[] = [
  {
    title: "Цена ниже вторичного рынка",
    text: "Автомобили после лизинга часто продаются дешевле аналогичных предложений на вторичном рынке.",
    iconSrc: "/brands/benefit-1.svg",
  },
  {
    title: "Понятная история эксплуатации",
    text: "Большинство автомобилей обслуживалось у официальных дилеров.",
    iconSrc: "/brands/benefit-2.svg",
  },
  {
    title: "Регулярный поток новых автомобилей",
    text: "Лизинговые компании регулярно реализуют автомобили после завершения договоров.",
    iconSrc: "/brands/benefit-3.svg",
  },
  {
    title: "Доступ к изъятым автомобилям",
    text: "На платформе можно найти изъятые автомобили и конфискат.",
    iconSrc: "/brands/benefit-4.svg",
  },
];

const PROCESS_STEPS = [
  "Лизинговые компании размещают автомобили после лизинга",
  "Reactiv собирает предложения в единый каталог",
  "Брокеры, агенты и дилеры находят автомобили",
  "После запроса открываются контакты владельца лота",
];

const AUDIENCE_CARDS: AudienceCard[] = [
  {
    title: "Автомобильные брокеры и агенты",
    text: "Поиск автомобилей после лизинга и изъятых авто для клиентов.",
  },
  {
    title: "Автодилеры",
    text: "Дополнительный источник автомобилей для автосалонов.",
  },
  {
    title: "Таксопарки",
    text: "Закупка автомобилей с пробегом для автопарков.",
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Что значит автомобиль после лизинга",
    answer:
      "Автомобиль после лизинга - это машина, которая использовалась по договору лизинга и после завершения договора продается лизинговой компанией.",
  },
  {
    question: "Где продаются изъятые автомобили",
    answer:
      "Изъятые автомобили обычно реализуются через площадки лизинговых компаний или через агрегаторы.",
  },
  {
    question: "Можно ли купить авто после лизинга дешевле рынка",
    answer:
      "Да, автомобили после лизинга иногда продаются дешевле аналогичных предложений на вторичном рынке.",
  },
];

const HERO_IMAGE_URL = "/landing-hero.jpg";
const BRANDS_ARROW_ICON_URL = "/brands/arrow-up-right.svg";
const ABOUT_CHECKMARK_ICON_URL = "/brands/checkmark-icon.svg";
const ABOUT_LEASING_TYPES = [
  "автомобили после завершения лизинга",
  "изъятые автомобили",
  "конфискат лизинговых компаний",
  "корпоративные автомобили с пробегом",
];
const POPULAR_PASSENGER_BRANDS = PASSENGER_BRAND_PAGES;

const POPULAR_TRUCK_BRANDS = TRUCK_BRAND_PAGES;

const FEATURED_BRAND_TARGETS: FeaturedBrandTarget[] = [
  { name: "SITRAK", query: "SITRAK" },
  { name: "Shacman", query: "Shacman" },
  { name: "Haval", query: "Haval" },
  { name: "BMW", query: "BMW" },
];

const FEATURED_PRICE_MIN_RUB = 1_500_000;
const FEATURED_PRICE_MAX_RUB = 8_000_000;
const FEATURED_CANDIDATE_PAGE_SIZE = 8;

const previewLivenessCache = new Map<string, boolean>();

function formatPrice(value: number | null): string {
  if (value === null) {
    return "Цена по запросу";
  }

  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatMileage(value: number | null): string {
  if (value === null) {
    return "Пробег уточняется";
  }

  return `${value.toLocaleString("ru-RU")} км`;
}

function formatYear(value: number | null): string {
  if (value === null) {
    return "Год не указан";
  }

  return String(value);
}

function getItemPreviewUrl(item: CatalogListItem): string | null {
  if (!item.previewUrl) {
    return null;
  }

  return getMediaPreviewImageUrl(item.previewUrl, { width: 360 });
}

async function isPreviewAlive(previewUrl: string): Promise<boolean> {
  const cached = previewLivenessCache.get(previewUrl);
  if (cached !== undefined) {
    return cached;
  }

  const imageUrl = getMediaPreviewImageUrl(previewUrl, { width: 360 });
  try {
    const response = await fetch(imageUrl, {
      method: "HEAD",
      credentials: "include",
      cache: "no-store",
    });
    const isAlive = response.ok;
    previewLivenessCache.set(previewUrl, isAlive);
    return isAlive;
  } catch {
    previewLivenessCache.set(previewUrl, false);
    return false;
  }
}

async function pickFeaturedItemByBrand(
  target: FeaturedBrandTarget,
): Promise<CatalogListItem | null> {
  const response = await getCatalogItems({
    page: 1,
    pageSize: FEATURED_CANDIDATE_PAGE_SIZE,
    sortBy: "created_at",
    sortDir: "desc",
    brand: target.query,
    priceMin: FEATURED_PRICE_MIN_RUB,
    priceMax: FEATURED_PRICE_MAX_RUB,
    onlyWithPreview: "true",
  });

  const candidates = response.items.filter((item) => Boolean(item.previewUrl));
  for (const item of candidates) {
    if (item.previewUrl && (await isPreviewAlive(item.previewUrl))) {
      return item;
    }
  }

  return null;
}

function BrandLogo({ brand, src }: { brand: string; src: string }) {
  return (
    <img className="landing-brand-logo" src={src} alt={`${brand} logo`} />
  );
}

function ProductCard({ item }: { item: CatalogListItem }) {
  const imageUrl = getItemPreviewUrl(item);

  return (
    <article className="landing-product-card">
      <Link className="landing-product-card__image-wrap" to={`/showcase/${item.id}`}>
        {imageUrl ? (
          <img className="landing-product-card__image" src={imageUrl} alt={item.title} />
        ) : (
          <div className="landing-product-card__image landing-product-card__image--placeholder">
            <span>{item.brand}</span>
          </div>
        )}
      </Link>

      <div className="landing-product-card__body">
        {item.bookingStatus ? <span className="landing-status-pill">{item.bookingStatus}</span> : null}
        <h3>{item.title || `${item.brand} ${item.model}`}</h3>
        <p className="landing-product-card__meta">
          {formatYear(item.year)} · {formatMileage(item.mileageKm)}
        </p>
        <p className="landing-product-card__meta">
          {item.storageAddress || item.responsiblePerson || "Локация уточняется"}
        </p>
        <div className="landing-product-card__footer">
          <strong>{formatPrice(item.price)}</strong>
        </div>
      </div>
    </article>
  );
}

export function LandingPage() {
  const [catalogState, setCatalogState] = useState<LandingCatalogState>({
    featuredItems: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLandingData() {
      setIsLoading(true);
      setError(null);

      try {
        const featuredByBrand = await Promise.all(
          FEATURED_BRAND_TARGETS.map((target) => pickFeaturedItemByBrand(target)),
        );

        if (!isMounted) {
          return;
        }

        setCatalogState({
          featuredItems: featuredByBrand.filter(
            (item): item is CatalogListItem => item !== null,
          ),
        });
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        const nextError =
          caughtError instanceof Error ? caughtError.message : "Не удалось загрузить данные лендинга";
        setError(nextError);

        void logActivityEvent({
          eventType: "api_error",
          page: "/",
          payload: {
            source: "landing_page",
            message: nextError,
          },
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLandingData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector(".landing-page");
    if (!root) {
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();

    while (currentNode) {
      const textNode = currentNode as Text;
      const value = textNode.nodeValue;
      if (value && value.includes(" ")) {
        textNode.nodeValue = value.replace(
          PREPOSITION_NBSP_PATTERN,
          (_full, prefix: string, preposition: string) => {
            return `${prefix}${preposition}\u00A0`;
          },
        );
      }
      currentNode = walker.nextNode();
    }
  }, [catalogState, error, isLoading]);

  return (
    <section className="landing-page">
      <div className="landing-page__shell">
        <div className="landing-hero">
          <div className="landing-hero__copy">
            <div className="landing-hero__intro">
              <h1>Авто после лизинга — каталог изъятых и лизинговых автомобилей</h1>
              <p>
                Платформа Reactiv собирает автомобили после лизинга со всей России. В каталоге
                доступны изъятые автомобили, конфискат и машины после завершения лизинговых
                договоров от лизинговых компаний.
              </p>
            </div>

            <div className="landing-hero__actions">
              <Link className="landing-primary-button" to="/">
                Смотреть каталог автомобилей
              </Link>
            </div>
          </div>

          <div className="landing-hero__media">
            <img src={HERO_IMAGE_URL} alt="Автомобиль после лизинга" />
          </div>
        </div>

        <section className="landing-section">
          <div className="landing-section__heading">
            <h2>Популярные марки легковых автомобилей после лизинга</h2>
          </div>
          <div className="landing-brand-carousel">
            {POPULAR_PASSENGER_BRANDS.map((brand) => (
              <Link
                key={brand.slug}
                className="landing-brand-card"
                to={`/${brand.slug}`}
              >
                <div className="landing-brand-card__top">
                  <div className="landing-brand-card__logo-wrap">
                    <BrandLogo brand={brand.name} src={brand.logoSrc} />
                  </div>
                  <img
                    className="landing-brand-card__arrow"
                    src={BRANDS_ARROW_ICON_URL}
                    alt=""
                    aria-hidden="true"
                  />
                </div>
                <strong>{brand.name}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section__heading">
            <h2>Популярные марки грузовых автомобилей после лизинга</h2>
          </div>
          <div className="landing-brand-carousel">
            {POPULAR_TRUCK_BRANDS.map((brand) => (
              <Link
                key={brand.slug}
                className="landing-brand-card"
                to={`/${brand.slug}`}
              >
                <div className="landing-brand-card__top">
                  <div className="landing-brand-card__logo-wrap">
                    <BrandLogo brand={brand.name} src={brand.logoSrc} />
                  </div>
                  <img
                    className="landing-brand-card__arrow"
                    src={BRANDS_ARROW_ICON_URL}
                    alt=""
                    aria-hidden="true"
                  />
                </div>
                <strong>{brand.name}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section__heading">
            <h2>Авто после лизинга в продаже</h2>
            <Link className="landing-inline-link" to="/">
              Смотреть всю витрину
            </Link>
          </div>

          {error ? (
            <div className="landing-api-fallback" role="status">
              <strong>Каталог временно недоступен</strong>
              <p>{error}</p>
              <Link className="landing-primary-button" to="/">
                Перейти в витрину
              </Link>
            </div>
          ) : (
            <div className="landing-product-grid">
              {(catalogState.featuredItems.length > 0 ? catalogState.featuredItems : []).map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
              {!isLoading && catalogState.featuredItems.length === 0 && (
                <div className="landing-api-fallback" role="status">
                  <strong>Лоты скоро появятся</strong>
                  <p>Как только каталог вернет данные, здесь отобразятся актуальные автомобили.</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section id="about" className="landing-section">
          <div className="landing-explainer">
            <div className="landing-explainer__headline">
              <h2>Что такое автомобили после лизинга</h2>
              <div className="landing-explainer__stats">
                <article className="landing-explainer-stat">
                  <strong>7000+</strong>
                  <span>единиц техники</span>
                </article>
                <article className="landing-explainer-stat">
                  <strong>500+</strong>
                  <span>заявок обработано</span>
                </article>
              </div>
            </div>

            <div className="landing-explainer__content">
              <p className="landing-explainer__text">
                Автомобили после лизинга - это машины, которые использовались компаниями по договору
                лизинга и после завершения договора или его прекращения выставляются на продажу. В
                продаже можно встретить несколько типов таких автомобилей:
              </p>
              <ul className="landing-check-list">
                {ABOUT_LEASING_TYPES.map((item) => (
                  <li key={item}>
                    <img className="landing-check-list__icon" src={ABOUT_CHECKMARK_ICON_URL} alt="" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="landing-explainer__text">
                Такие машины часто реализуются через площадки продажи лизинговых автомобилей.
                Платформа Reactiv агрегирует предложения лизинговых компаний и формирует единый
                каталог автомобилей после лизинга.
              </p>
              <Link className="landing-primary-button landing-explainer__button" to="/">
                Смотреть каталог автомобилей
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--benefits">
          <div className="landing-section__heading">
            <h2>Почему покупают авто после лизинга</h2>
          </div>
          <div className="landing-benefits-grid">
            {BENEFIT_CARDS.map((item) => (
              <article key={item.title} className="landing-benefit-card">
                <div className="landing-benefit-card__body">
                  <h3>{item.title}</h3>
                  <div className="landing-benefit-card__divider" aria-hidden />
                  <p>{item.text}</p>
                </div>
                <span className="landing-benefit-card__icon-wrap" aria-hidden>
                  <img className="landing-benefit-card__icon" src={item.iconSrc} alt="" />
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section__heading">
            <h2>Как работает платформа Reactiv</h2>
          </div>
          <div className="landing-process-grid">
            {PROCESS_STEPS.map((item, index) => (
              <article key={item} className="landing-process-card">
                <span className="landing-process-card__index">{index + 1}</span>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-section--audience">
          <div className="landing-audience">
            <div className="landing-audience__title">
              <h2>Кому подходит платформа</h2>
            </div>

            <div className="landing-audience__cards">
              {AUDIENCE_CARDS.map((item) => (
                <article key={item.title} className="landing-audience-card">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="landing-section landing-section--faq">
          <div className="landing-section__heading">
            <h2>Часто задаваемые вопросы</h2>
          </div>
          <div className="landing-faq-list">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="landing-faq-card">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-section--banner">
          <div className="landing-catalog-banner">
            <div>
              <h2>Смотреть автомобили после лизинга</h2>
              <p>Перейдите в каталог и найдите автомобиль</p>
            </div>
            <Link className="landing-catalog-banner__button" to="/">
              Перейти
            </Link>
          </div>
        </section>

      </div>
    </section>
  );
}
