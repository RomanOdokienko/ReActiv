import { Link } from "react-router-dom";
import "../styles/blog.css";

interface BlogCardItem {
  title: string;
  readingTime: string;
  href?: string;
}

const BLOG_CARDS: BlogCardItem[] = [
  {
    title: "Авто после лизинга: стоит ли покупать и чего опасаться",
    readingTime: "~ 8 минут чтения",
    href: "/blog/auto-posle-lizinga-stoit-li-pokupat-i-chego-opasatsya",
  },
  {
    title: "Скоро здесь будут статьи",
    readingTime: "-",
  },
  {
    title: "Скоро здесь будут статьи",
    readingTime: "-",
  },
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
          {BLOG_CARDS.map((card, index) => (
            <article className="blog-card" key={`${card.title}-${index}`}>
              {card.href ? (
                <Link className="blog-card__link-wrap" to={card.href}>
                  <div className="blog-card__title-wrap">
                    <h2>{card.title}</h2>
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
          ))}
        </div>
      </div>
    </section>
  );
}
