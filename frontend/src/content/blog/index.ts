import type { BlogArticleDefinition, BlogArticleMeta, BlogPlaceholderCard } from "./types";

type BlogArticleModule = {
  article: BlogArticleDefinition;
};

const modules = import.meta.glob<BlogArticleModule>("./articles/*.tsx", { eager: true });

const articleDefinitions = Object.values(modules)
  .map((module) => module.article)
  .sort((left, right) => left.order - right.order);

const slugRegistry = new Set<string>();
for (const article of articleDefinitions) {
  if (slugRegistry.has(article.meta.slug)) {
    throw new Error(`Duplicate blog article slug detected: ${article.meta.slug}`);
  }
  slugRegistry.add(article.meta.slug);
}

export const BLOG_ARTICLES: BlogArticleMeta[] = articleDefinitions.map((article) => article.meta);

export const BLOG_PLACEHOLDER_CARDS: BlogPlaceholderCard[] = [];

const BLOG_ARTICLES_BY_SLUG = new Map(
  articleDefinitions.map((article) => [article.meta.slug, article.meta]),
);

const BLOG_ARTICLE_RENDERERS_BY_SLUG = new Map(
  articleDefinitions.map((article) => [article.meta.slug, article.render]),
);

export function getBlogArticleBySlug(slug: string): BlogArticleMeta | undefined {
  return BLOG_ARTICLES_BY_SLUG.get(slug);
}

export function getBlogArticleRendererBySlug(
  slug: string,
): (() => ReturnType<BlogArticleDefinition["render"]>) | undefined {
  return BLOG_ARTICLE_RENDERERS_BY_SLUG.get(slug);
}
