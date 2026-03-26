import { Link, Navigate, useParams } from "react-router-dom";
import {
  getBlogArticleBySlug,
  getBlogArticleRendererBySlug,
} from "../content/blog-articles";
import "../styles/blog-article.css";

export function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getBlogArticleBySlug(slug) : undefined;
  const renderArticle = article ? getBlogArticleRendererBySlug(article.slug) : undefined;

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
          <div className="blog-article__hero" aria-hidden="true" />
          <h1>{article.title}</h1>
        </div>
        {renderArticle()}
      </article>
    </section>
  );
}
