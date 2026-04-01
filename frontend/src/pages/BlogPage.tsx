import { Link } from "react-router-dom";
import { BLOG_ARTICLES, BLOG_PLACEHOLDER_CARDS } from "../content/blog-articles";
import "../styles/blog.css";

interface BlogCardItem {
  title: string;
  readingTime: string;
  coverSrc: string;
  href?: string;
}

const DEFAULT_BLOG_COVER = "/blog/covers/placeholder-flow.svg";

const BLOG_COVER_BY_SLUG: Record<string, string> = {
  "auto-posle-lizinga-stoit-li-pokupat-i-chego-opasatsya":
    "/blog/covers/risk-and-shield.svg",
  "kak-proverit-avtomobil-na-lizing-po-vin-i-gosnomeru":
    "/blog/covers/vin-and-plate-check.svg",
  "kupit-avto-s-probegom-u-lizingovoy-kompanii-poshagovo":
    "/blog/covers/lot-to-deal-route.svg",
  "chek-list-osmotra-avto-posle-lizinga":
    "/blog/covers/inspection-checklist.svg",
  "pokupka-avto-posle-lizinga-s-nds": "/blog/covers/vat-documents.svg",
};

const BLOG_CARDS: BlogCardItem[] = [
  ...BLOG_ARTICLES.map((article) => ({
    title: article.cardTitle,
    readingTime: article.readingTime,
    coverSrc: BLOG_COVER_BY_SLUG[article.slug] ?? DEFAULT_BLOG_COVER,
    href: `/blog/${article.slug}`,
  })),
  ...BLOG_PLACEHOLDER_CARDS.map((card) => ({
    title: card.title,
    readingTime: card.readingTime,
    coverSrc: DEFAULT_BLOG_COVER,
  })),
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 17L17 7M17 7H8M17 7V16" />
    </svg>
  );
}

export function BlogPage() {
  return (
    <section className="blog-page">
      <div className="blog-page__section">
        <h1>Блог команды реАктив</h1>
        <div className="blog-page__cards">
          {BLOG_CARDS.map((card, index) => {
            return (
              <article className="blog-card" key={`${card.title}-${index}`}>
                {card.href ? (
                  <Link className="blog-card__link-wrap" to={card.href}>
                    <div className="blog-card__title-wrap">
                      <h2>{card.title}</h2>
                      <div className="blog-card__mock-media" aria-hidden="true">
                        <img src={card.coverSrc} alt="" loading="lazy" decoding="async" />
                      </div>
                    </div>
                    <div className="blog-card__footer">
                      <p>{card.readingTime}</p>
                      <span className="blog-card__action" aria-hidden="true">
                        <ArrowIcon />
                      </span>
                    </div>
                  </Link>
                ) : (
                  <>
                    <div className="blog-card__title-wrap">
                      <h2>{card.title}</h2>
                      <div className="blog-card__mock-media" aria-hidden="true">
                        <img src={card.coverSrc} alt="" loading="lazy" decoding="async" />
                      </div>
                    </div>
                    <div className="blog-card__footer">
                      <p>{card.readingTime}</p>
                      <span className="blog-card__action" aria-hidden="true">
                        <ArrowIcon />
                      </span>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
