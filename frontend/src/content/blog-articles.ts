export interface BlogArticleMeta {
  slug: string;
  title: string;
  cardTitle: string;
  readingTime: string;
  seoTitle: string;
  seoDescription: string;
}

export interface BlogPlaceholderCard {
  title: string;
  readingTime: string;
}

export const BLOG_ARTICLES: BlogArticleMeta[] = [
  {
    slug: "auto-posle-lizinga-stoit-li-pokupat-i-chego-opasatsya",
    title: "Авто после лизинга: стоит ли покупать и чего опасаться",
    cardTitle: "Авто после лизинга: стоит ли покупать и чего опасаться",
    readingTime: "~ 8 минут чтения",
    seoTitle: "Авто после лизинга: стоит ли покупать и чего опасаться — Блог РеАктив",
    seoDescription:
      "Разбираем, как проверить авто после лизинга перед покупкой: ограничения, залоги, документы, риски и порядок безопасной сделки.",
  },
];

export const BLOG_PLACEHOLDER_CARDS: BlogPlaceholderCard[] = [
  {
    title: "Скоро здесь будут статьи",
    readingTime: "-",
  },
  {
    title: "Скоро здесь будут статьи",
    readingTime: "-",
  },
];

const BLOG_ARTICLES_BY_SLUG = new Map(BLOG_ARTICLES.map((article) => [article.slug, article]));

export function getBlogArticleBySlug(slug: string): BlogArticleMeta | undefined {
  return BLOG_ARTICLES_BY_SLUG.get(slug);
}
