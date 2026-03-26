import type { ReactElement } from "react";

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

export interface BlogArticleDefinition {
  order: number;
  meta: BlogArticleMeta;
  render: () => ReactElement;
}
