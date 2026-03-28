import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCatalogItems,
  getMediaPreviewImageUrl,
  logActivityEvent,
} from "../api/client";
import type { CatalogListItem } from "../types/api";
import "../styles/landing.css";

const PREPOSITION_NBSP_PATTERN =
  /(^|[\s([{'"В«вЂћ-])(Р°|Р±РµР·|РІ|РІРѕ|РґР»СЏ|РґРѕ|Р·Р°|Рё|РёР·|Рє|РєРѕ|РЅР°|РЅР°Рґ|РЅРµ|РЅРё|Рѕ|РѕР±|РѕР±Рѕ|РѕС‚|РїРѕ|РїРѕРґ|РїСЂРё|РїСЂРѕ|СЃ|СЃРѕ|Сѓ)\s+/giu;

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

interface PopularBrand {
  name: string;
  query: string;
  logoSrc: string;
}

interface FeaturedBrandTarget {
  name: string;
  query: string;
}

const BENEFIT_CARDS: BenefitCard[] = [
  {
    title: "Р¦РµРЅР° РЅРёР¶Рµ РІС‚РѕСЂРёС‡РЅРѕРіРѕ СЂС‹РЅРєР°",
    text: "РђРІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° С‡Р°СЃС‚Рѕ РїСЂРѕРґР°СЋС‚СЃСЏ РґРµС€РµРІР»Рµ Р°РЅР°Р»РѕРіРёС‡РЅС‹С… РїСЂРµРґР»РѕР¶РµРЅРёР№ РЅР° РІС‚РѕСЂРёС‡РЅРѕРј СЂС‹РЅРєРµ.",
    iconSrc: "/brands/benefit-1.svg",
  },
  {
    title: "РџРѕРЅСЏС‚РЅР°СЏ РёСЃС‚РѕСЂРёСЏ СЌРєСЃРїР»СѓР°С‚Р°С†РёРё",
    text: "Р‘РѕР»СЊС€РёРЅСЃС‚РІРѕ Р°РІС‚РѕРјРѕР±РёР»РµР№ РѕР±СЃР»СѓР¶РёРІР°Р»РѕСЃСЊ Сѓ РѕС„РёС†РёР°Р»СЊРЅС‹С… РґРёР»РµСЂРѕРІ.",
    iconSrc: "/brands/benefit-2.svg",
  },
  {
    title: "Р РµРіСѓР»СЏСЂРЅС‹Р№ РїРѕС‚РѕРє РЅРѕРІС‹С… Р°РІС‚РѕРјРѕР±РёР»РµР№",
    text: "Р›РёР·РёРЅРіРѕРІС‹Рµ РєРѕРјРїР°РЅРёРё СЂРµРіСѓР»СЏСЂРЅРѕ СЂРµР°Р»РёР·СѓСЋС‚ Р°РІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ РґРѕРіРѕРІРѕСЂРѕРІ.",
    iconSrc: "/brands/benefit-3.svg",
  },
  {
    title: "Р”РѕСЃС‚СѓРї Рє РёР·СЉСЏС‚С‹Рј Р°РІС‚РѕРјРѕР±РёР»СЏРј",
    text: "РќР° РїР»Р°С‚С„РѕСЂРјРµ РјРѕР¶РЅРѕ РЅР°Р№С‚Рё РёР·СЉСЏС‚С‹Рµ Р°РІС‚РѕРјРѕР±РёР»Рё Рё РєРѕРЅС„РёСЃРєР°С‚.",
    iconSrc: "/brands/benefit-4.svg",
  },
];

const PROCESS_STEPS = [
  "Р›РёР·РёРЅРіРѕРІС‹Рµ РєРѕРјРїР°РЅРёРё СЂР°Р·РјРµС‰Р°СЋС‚ Р°РІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р»РёР·РёРЅРіР°",
  "Reactiv СЃРѕР±РёСЂР°РµС‚ РїСЂРµРґР»РѕР¶РµРЅРёСЏ РІ РµРґРёРЅС‹Р№ РєР°С‚Р°Р»РѕРі",
  "Р‘СЂРѕРєРµСЂС‹, Р°РіРµРЅС‚С‹ Рё РґРёР»РµСЂС‹ РЅР°С…РѕРґСЏС‚ Р°РІС‚РѕРјРѕР±РёР»Рё",
  "РџРѕСЃР»Рµ Р·Р°РїСЂРѕСЃР° РѕС‚РєСЂС‹РІР°СЋС‚СЃСЏ РєРѕРЅС‚Р°РєС‚С‹ РІР»Р°РґРµР»СЊС†Р° Р»РѕС‚Р°",
];

const AUDIENCE_CARDS: AudienceCard[] = [
  {
    title: "РђРІС‚РѕРјРѕР±РёР»СЊРЅС‹Рµ Р±СЂРѕРєРµСЂС‹ Рё Р°РіРµРЅС‚С‹",
    text: "РџРѕРёСЃРє Р°РІС‚РѕРјРѕР±РёР»РµР№ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° Рё РёР·СЉСЏС‚С‹С… Р°РІС‚Рѕ РґР»СЏ РєР»РёРµРЅС‚РѕРІ.",
  },
  {
    title: "РђРІС‚РѕРґРёР»РµСЂС‹",
    text: "Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє Р°РІС‚РѕРјРѕР±РёР»РµР№ РґР»СЏ Р°РІС‚РѕСЃР°Р»РѕРЅРѕРІ.",
  },
  {
    title: "РўР°РєСЃРѕРїР°СЂРєРё",
    text: "Р—Р°РєСѓРїРєР° Р°РІС‚РѕРјРѕР±РёР»РµР№ СЃ РїСЂРѕР±РµРіРѕРј РґР»СЏ Р°РІС‚РѕРїР°СЂРєРѕРІ.",
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Р§С‚Рѕ Р·РЅР°С‡РёС‚ Р°РІС‚РѕРјРѕР±РёР»СЊ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР°",
    answer:
      "РђРІС‚РѕРјРѕР±РёР»СЊ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° - СЌС‚Рѕ РјР°С€РёРЅР°, РєРѕС‚РѕСЂР°СЏ РёСЃРїРѕР»СЊР·РѕРІР°Р»Р°СЃСЊ РїРѕ РґРѕРіРѕРІРѕСЂСѓ Р»РёР·РёРЅРіР° Рё РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ РґРѕРіРѕРІРѕСЂР° РїСЂРѕРґР°РµС‚СЃСЏ Р»РёР·РёРЅРіРѕРІРѕР№ РєРѕРјРїР°РЅРёРµР№.",
  },
  {
    question: "Р“РґРµ РїСЂРѕРґР°СЋС‚СЃСЏ РёР·СЉСЏС‚С‹Рµ Р°РІС‚РѕРјРѕР±РёР»Рё",
    answer:
      "РР·СЉСЏС‚С‹Рµ Р°РІС‚РѕРјРѕР±РёР»Рё РѕР±С‹С‡РЅРѕ СЂРµР°Р»РёР·СѓСЋС‚СЃСЏ С‡РµСЂРµР· РїР»РѕС‰Р°РґРєРё Р»РёР·РёРЅРіРѕРІС‹С… РєРѕРјРїР°РЅРёР№ РёР»Рё С‡РµСЂРµР· Р°РіСЂРµРіР°С‚РѕСЂС‹.",
  },
  {
    question: "РњРѕР¶РЅРѕ Р»Рё РєСѓРїРёС‚СЊ Р°РІС‚Рѕ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° РґРµС€РµРІР»Рµ СЂС‹РЅРєР°",
    answer:
      "Р”Р°, Р°РІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° РёРЅРѕРіРґР° РїСЂРѕРґР°СЋС‚СЃСЏ РґРµС€РµРІР»Рµ Р°РЅР°Р»РѕРіРёС‡РЅС‹С… РїСЂРµРґР»РѕР¶РµРЅРёР№ РЅР° РІС‚РѕСЂРёС‡РЅРѕРј СЂС‹РЅРєРµ.",
  },
];

const HERO_IMAGE_URL = "/landing-hero.jpg";
const BRANDS_ARROW_ICON_URL = "/brands/arrow-up-right.svg";
const ABOUT_CHECKMARK_ICON_URL = "/brands/checkmark-icon.svg";
const ABOUT_LEASING_TYPES = [
  "Р°РІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ Р»РёР·РёРЅРіР°",
  "РёР·СЉСЏС‚С‹Рµ Р°РІС‚РѕРјРѕР±РёР»Рё",
  "РєРѕРЅС„РёСЃРєР°С‚ Р»РёР·РёРЅРіРѕРІС‹С… РєРѕРјРїР°РЅРёР№",
  "РєРѕСЂРїРѕСЂР°С‚РёРІРЅС‹Рµ Р°РІС‚РѕРјРѕР±РёР»Рё СЃ РїСЂРѕР±РµРіРѕРј",
];
const POPULAR_PASSENGER_BRANDS: PopularBrand[] = [
  { name: "Mercedes", query: "Mercedes-Benz", logoSrc: "/brands/mersedes.png" },
  { name: "BMW", query: "BMW", logoSrc: "/brands/bmw.png" },
  { name: "Lexus", query: "Lexus", logoSrc: "/brands/lexus.png" },
  { name: "Li", query: "Li", logoSrc: "/brands/li.png" },
  { name: "Haval", query: "Haval", logoSrc: "/brands/haval.png" },
];

const POPULAR_TRUCK_BRANDS: PopularBrand[] = [
  { name: "SITRAK", query: "SITRAK", logoSrc: "/brands/sitrak.png" },
  { name: "Shacman", query: "Shacman", logoSrc: "/brands/shacman.png" },
];

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
    return "Р¦РµРЅР° РїРѕ Р·Р°РїСЂРѕСЃСѓ";
  }

  return `${value.toLocaleString("ru-RU")} в‚Ѕ`;
}

function formatMileage(value: number | null): string {
  if (value === null) {
    return "РџСЂРѕР±РµРі СѓС‚РѕС‡РЅСЏРµС‚СЃСЏ";
  }

  return `${value.toLocaleString("ru-RU")} РєРј`;
}

function formatYear(value: number | null): string {
  if (value === null) {
    return "Р“РѕРґ РЅРµ СѓРєР°Р·Р°РЅ";
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
          {formatYear(item.year)} В· {formatMileage(item.mileageKm)}
        </p>
        <p className="landing-product-card__meta">
          {item.storageAddress || item.responsiblePerson || "Р›РѕРєР°С†РёСЏ СѓС‚РѕС‡РЅСЏРµС‚СЃСЏ"}
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
          caughtError instanceof Error ? caughtError.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ Р»РµРЅРґРёРЅРіР°";
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
              <h1>РђРІС‚Рѕ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° вЂ” РєР°С‚Р°Р»РѕРі РёР·СЉСЏС‚С‹С… Рё Р»РёР·РёРЅРіРѕРІС‹С… Р°РІС‚РѕРјРѕР±РёР»РµР№</h1>
              <p>
                РџР»Р°С‚С„РѕСЂРјР° Reactiv СЃРѕР±РёСЂР°РµС‚ Р°РІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° СЃРѕ РІСЃРµР№ Р РѕСЃСЃРёРё. Р’ РєР°С‚Р°Р»РѕРіРµ
                РґРѕСЃС‚СѓРїРЅС‹ РёР·СЉСЏС‚С‹Рµ Р°РІС‚РѕРјРѕР±РёР»Рё, РєРѕРЅС„РёСЃРєР°С‚ Рё РјР°С€РёРЅС‹ РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ Р»РёР·РёРЅРіРѕРІС‹С…
                РґРѕРіРѕРІРѕСЂРѕРІ РѕС‚ Р»РёР·РёРЅРіРѕРІС‹С… РєРѕРјРїР°РЅРёР№.
              </p>
            </div>

            <div className="landing-hero__actions">
              <Link className="landing-primary-button" to="/">
                РЎРјРѕС‚СЂРµС‚СЊ РєР°С‚Р°Р»РѕРі Р°РІС‚РѕРјРѕР±РёР»РµР№
              </Link>
            </div>
          </div>

          <div className="landing-hero__media">
            <img src={HERO_IMAGE_URL} alt="РђРІС‚РѕРјРѕР±РёР»СЊ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР°" />
          </div>
        </div>

        <section className="landing-section">
          <div className="landing-section__heading">
            <h2>Популярные марки легковых автомобилей после лизинга</h2>
          </div>
          <div className="landing-brand-grid">
            {POPULAR_PASSENGER_BRANDS.map((brand) => (
              <Link
                key={brand.name}
                className="landing-brand-card"
                to={`/?brand=${encodeURIComponent(brand.query)}`}
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
          <div className="landing-brand-grid">
            {POPULAR_TRUCK_BRANDS.map((brand) => (
              <Link
                key={brand.name}
                className="landing-brand-card"
                to={`/?brand=${encodeURIComponent(brand.query)}`}
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
            <h2>РђРІС‚Рѕ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° РІ РїСЂРѕРґР°Р¶Рµ</h2>
            <Link className="landing-inline-link" to="/">
              РЎРјРѕС‚СЂРµС‚СЊ РІСЃСЋ РІРёС‚СЂРёРЅСѓ
            </Link>
          </div>

          {error ? (
            <div className="landing-api-fallback" role="status">
              <strong>РљР°С‚Р°Р»РѕРі РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ</strong>
              <p>{error}</p>
              <Link className="landing-primary-button" to="/">
                РџРµСЂРµР№С‚Рё РІ РІРёС‚СЂРёРЅСѓ
              </Link>
            </div>
          ) : (
            <div className="landing-product-grid">
              {(catalogState.featuredItems.length > 0 ? catalogState.featuredItems : []).map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
              {!isLoading && catalogState.featuredItems.length === 0 && (
                <div className="landing-api-fallback" role="status">
                  <strong>Р›РѕС‚С‹ СЃРєРѕСЂРѕ РїРѕСЏРІСЏС‚СЃСЏ</strong>
                  <p>РљР°Рє С‚РѕР»СЊРєРѕ РєР°С‚Р°Р»РѕРі РІРµСЂРЅРµС‚ РґР°РЅРЅС‹Рµ, Р·РґРµСЃСЊ РѕС‚РѕР±СЂР°Р·СЏС‚СЃСЏ Р°РєС‚СѓР°Р»СЊРЅС‹Рµ Р°РІС‚РѕРјРѕР±РёР»Рё.</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section id="about" className="landing-section">
          <div className="landing-explainer">
            <div className="landing-explainer__headline">
              <h2>Р§С‚Рѕ С‚Р°РєРѕРµ Р°РІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р»РёР·РёРЅРіР°</h2>
              <div className="landing-explainer__stats">
                <article className="landing-explainer-stat">
                  <strong>7000+</strong>
                  <span>РµРґРёРЅРёС† С‚РµС…РЅРёРєРё</span>
                </article>
                <article className="landing-explainer-stat">
                  <strong>500+</strong>
                  <span>Р·Р°СЏРІРѕРє РѕР±СЂР°Р±РѕС‚Р°РЅРѕ</span>
                </article>
              </div>
            </div>

            <div className="landing-explainer__content">
              <p className="landing-explainer__text">
                РђРІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р»РёР·РёРЅРіР° - СЌС‚Рѕ РјР°С€РёРЅС‹, РєРѕС‚РѕСЂС‹Рµ РёСЃРїРѕР»СЊР·РѕРІР°Р»РёСЃСЊ РєРѕРјРїР°РЅРёСЏРјРё РїРѕ РґРѕРіРѕРІРѕСЂСѓ
                Р»РёР·РёРЅРіР° Рё РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ РґРѕРіРѕРІРѕСЂР° РёР»Рё РµРіРѕ РїСЂРµРєСЂР°С‰РµРЅРёСЏ РІС‹СЃС‚Р°РІР»СЏСЋС‚СЃСЏ РЅР° РїСЂРѕРґР°Р¶Сѓ. Р’
                РїСЂРѕРґР°Р¶Рµ РјРѕР¶РЅРѕ РІСЃС‚СЂРµС‚РёС‚СЊ РЅРµСЃРєРѕР»СЊРєРѕ С‚РёРїРѕРІ С‚Р°РєРёС… Р°РІС‚РѕРјРѕР±РёР»РµР№:
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
                РўР°РєРёРµ РјР°С€РёРЅС‹ С‡Р°СЃС‚Рѕ СЂРµР°Р»РёР·СѓСЋС‚СЃСЏ С‡РµСЂРµР· РїР»РѕС‰Р°РґРєРё РїСЂРѕРґР°Р¶Рё Р»РёР·РёРЅРіРѕРІС‹С… Р°РІС‚РѕРјРѕР±РёР»РµР№.
                РџР»Р°С‚С„РѕСЂРјР° Reactiv Р°РіСЂРµРіРёСЂСѓРµС‚ РїСЂРµРґР»РѕР¶РµРЅРёСЏ Р»РёР·РёРЅРіРѕРІС‹С… РєРѕРјРїР°РЅРёР№ Рё С„РѕСЂРјРёСЂСѓРµС‚ РµРґРёРЅС‹Р№
                РєР°С‚Р°Р»РѕРі Р°РІС‚РѕРјРѕР±РёР»РµР№ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР°.
              </p>
              <Link className="landing-primary-button landing-explainer__button" to="/">
                РЎРјРѕС‚СЂРµС‚СЊ РєР°С‚Р°Р»РѕРі Р°РІС‚РѕРјРѕР±РёР»РµР№
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--benefits">
          <div className="landing-section__heading">
            <h2>РџРѕС‡РµРјСѓ РїРѕРєСѓРїР°СЋС‚ Р°РІС‚Рѕ РїРѕСЃР»Рµ Р»РёР·РёРЅРіР°</h2>
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
            <h2>РљР°Рє СЂР°Р±РѕС‚Р°РµС‚ РїР»Р°С‚С„РѕСЂРјР° Reactiv</h2>
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
              <h2>РљРѕРјСѓ РїРѕРґС…РѕРґРёС‚ РїР»Р°С‚С„РѕСЂРјР°</h2>
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
            <h2>Р§Р°СЃС‚Рѕ Р·Р°РґР°РІР°РµРјС‹Рµ РІРѕРїСЂРѕСЃС‹</h2>
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
              <h2>РЎРјРѕС‚СЂРµС‚СЊ Р°РІС‚РѕРјРѕР±РёР»Рё РїРѕСЃР»Рµ Р»РёР·РёРЅРіР°</h2>
              <p>РџРµСЂРµР№РґРёС‚Рµ РІ РєР°С‚Р°Р»РѕРі Рё РЅР°Р№РґРёС‚Рµ Р°РІС‚РѕРјРѕР±РёР»СЊ</p>
            </div>
            <Link className="landing-catalog-banner__button" to="/">
              РџРµСЂРµР№С‚Рё
            </Link>
          </div>
        </section>

      </div>
    </section>
  );
}
