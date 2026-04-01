import { Link, Navigate, useParams } from "react-router-dom";
import {
  getBlogArticleBySlug,
  getBlogArticleRendererBySlug,
} from "../content/blog-articles";
import "../styles/blog-article.css";

const DEFAULT_ARTICLE_HERO = "/blog/covers/placeholder-flow.svg";

const ARTICLE_HERO_BY_SLUG: Record<string, string> = {
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

export function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getBlogArticleBySlug(slug) : undefined;
  const renderArticle = article ? getBlogArticleRendererBySlug(article.slug) : undefined;
  const heroSrc = article ? ARTICLE_HERO_BY_SLUG[article.slug] ?? DEFAULT_ARTICLE_HERO : DEFAULT_ARTICLE_HERO;

  if (!article || !renderArticle) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <section className="blog-article-page">
      <article className="blog-article">
        <div className="blog-article__intro">
          <Link className="blog-article__back-link" to="/blog">
            Вернуться ко всем статьям
          </Link>
          <div className="blog-article__hero" aria-hidden="true">
            <img src={heroSrc} alt="" decoding="async" />
          </div>
          <h1>{article.title}</h1>
        </div>
        {renderArticle()}
      </article>
    </section>
  );
}
