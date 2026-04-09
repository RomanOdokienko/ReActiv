import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  getCurrentUser,
  getPlatformMode,
  logActivityEvent,
  logout,
} from "./api/client";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { LegalLinks, PrivacyPolicyLink, TermsLink } from "./components/LegalLinks";
import { getBlogArticleBySlug } from "./content/blog-articles";
import { PASSENGER_BRAND_PAGES } from "./content/passenger-brand-pages";
import { TRUCK_BRAND_PAGES } from "./content/truck-brand-pages";
import { LoginPage } from "./pages/LoginPage";
import type { AuthUser, PlatformMode } from "./types/api";

type AuthState = "checking" | "authorized" | "unauthorized";
type PlatformModeState = "checking" | PlatformMode;

const HIDDEN_ADMIN_LOGIN_PATH = "/staff-login-reactiv";
const ACTIVITY_VIEWER_LOGINS = new Set(["alexey"]);
const HOST_FORCED_TENANT_MAP: Record<string, string> = {
  "gpb.reactiv.pro": "gpb",
  "vtb.reactiv.pro": "vtb",
};
const SEO_WEB_BASE_URL = "https://reactiv.pro";
const SEO_KEYWORDS =
  "авто после лизинга, изъятые автомобили, конфискат авто, машины после лизинга, техника после лизинга";
const CATALOG_SEO_TITLE = "Изъятые авто и автомобили после лизинга — каталог Reactiv";
const CATALOG_SEO_DESCRIPTION =
  "Каталог авто после лизинга и изъятых автомобилей. В одном месте собраны машины и техника после лизинга, включая конфискат.";
const LANDING_SEO_TITLE =
  "Авто после лизинга и изъятые автомобили — витрина лизингового стока Reactiv";
const LANDING_SEO_DESCRIPTION =
  "Reactiv — платформа, где собраны авто после лизинга, изъятые автомобили и конфискат. Помогает находить машины и технику после лизинга.";
const BLOG_SEO_TITLE = "Блог команды РеАктив";
const BLOG_SEO_DESCRIPTION =
  "Блог команды РеАктив: статьи об авто после лизинга, разборы и рекомендации для рынка.";
const PARTNERS_SEO_TITLE = "Партнёрам — РеАктив";
const PARTNERS_SEO_DESCRIPTION =
  "Лендинг для партнёров РеАктив: как решаем проблему замороженного стока и ускоряем реализацию.";
const PUBLIC_TITLE = CATALOG_SEO_TITLE;
const AdminActivityPage = lazy(async () => {
  const module = await import("./pages/AdminActivityPage");
  return { default: module.AdminActivityPage };
});
const AdminHighlightsPage = lazy(async () => {
  const module = await import("./pages/AdminHighlightsPage");
  return { default: module.AdminHighlightsPage };
});
const AdminOperationsPage = lazy(async () => {
  const module = await import("./pages/AdminOperationsPage");
  return { default: module.AdminOperationsPage };
});
const AdminUsersPage = lazy(async () => {
  const module = await import("./pages/AdminUsersPage");
  return { default: module.AdminUsersPage };
});
const BlogArticlePage = lazy(async () => {
  const module = await import("./pages/BlogArticlePage");
  return { default: module.BlogArticlePage };
});
const BlogPage = lazy(async () => {
  const module = await import("./pages/BlogPage");
  return { default: module.BlogPage };
});
const CatalogPage = lazy(async () => {
  const module = await import("./pages/CatalogPage");
  return { default: module.CatalogPage };
});
const FavoritesPage = lazy(async () => {
  const module = await import("./pages/FavoritesPage");
  return { default: module.FavoritesPage };
});
const LandingPage = lazy(async () => {
  const module = await import("./pages/LandingPage");
  return { default: module.LandingPage };
});
const PartnersPage = lazy(async () => {
  const module = await import("./pages/PartnersPage");
  return { default: module.PartnersPage };
});
const ShowcaseItemPage = lazy(async () => {
  const module = await import("./pages/ShowcaseItemPage");
  return { default: module.ShowcaseItemPage };
});
const ShowcasePage = lazy(async () => {
  const module = await import("./pages/ShowcasePage");
  return { default: module.ShowcasePage };
});
const UploadPage = lazy(async () => {
  const module = await import("./pages/UploadPage");
  return { default: module.UploadPage };
});

function extractBlogSlug(pathname: string): string | null {
  if (!pathname.startsWith("/blog/")) {
    return null;
  }

  const rawSlug = pathname.slice("/blog/".length).split("/")[0];
  if (!rawSlug) {
    return null;
  }

  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}

function upsertMetaByName(name: string, content: string): void {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string): void {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector(
    `meta[property="${property}"]`,
  ) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}
function upsertCanonicalLink(href: string): void {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function PublicLegalFooter() {
  return (
    <footer className="public-legal-footer">
      <div className="public-legal-footer__inner">
        <LegalLinks className="legal-links" />
      </div>
    </footer>
  );
}

interface PublicBrandPageConfig {
  slug: string;
  name: string;
  filterBrand: string;
  filterBrandAliases?: string[];
}

const PUBLIC_BRAND_PAGES: PublicBrandPageConfig[] = Array.from(
  new Map(
    [...PASSENGER_BRAND_PAGES, ...TRUCK_BRAND_PAGES].map((item) => [item.slug, item]),
  ).values(),
);

const PUBLIC_BRAND_PAGES_BY_SLUG = new Map(
  PUBLIC_BRAND_PAGES.map((item) => [item.slug, item]),
);

function normalizePublicPathname(pathname: string): string {
  if (pathname.length <= 1) {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function resolvePublicBrandPageByPathname(pathname: string) {
  const normalizedPathname = normalizePublicPathname(pathname);
  if (!normalizedPathname.startsWith("/")) {
    return undefined;
  }

  const slug = normalizedPathname.slice(1);
  if (!slug || slug.includes("/")) {
    return undefined;
  }

  return PUBLIC_BRAND_PAGES_BY_SLUG.get(slug);
}

function isPublicCatalogPath(pathname: string): boolean {
  const normalizedPathname = normalizePublicPathname(pathname);
  return (
    normalizedPathname === "/" ||
    normalizedPathname === "/showcase" ||
    normalizedPathname.startsWith("/showcase/") ||
    Boolean(resolvePublicBrandPageByPathname(normalizedPathname))
  );
}

function isPublicLayoutPath(pathname: string): boolean {
  return (
    isPublicCatalogPath(pathname) ||
    pathname === "/landing" ||
    pathname === "/partners" ||
    pathname.startsWith("/partners/") ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/") ||
    pathname === "/login" ||
    pathname === HIDDEN_ADMIN_LOGIN_PATH
  );
}

function PublicSiteHeader({
  pathname,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onBrandClick,
}: {
  pathname: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onBrandClick: () => void;
}) {
  const catalogActive = isPublicCatalogPath(pathname);
  const landingActive = pathname === "/landing";
  const partnersActive = pathname === "/partners" || pathname.startsWith("/partners/");
  const blogActive = pathname === "/blog" || pathname.startsWith("/blog/");
  const loginActive = pathname === "/login";

  return (
    <header className="landing-header">
      <Link
        className="landing-header__brand"
        to="/"
        onClick={() => {
          onCloseMenu();
          onBrandClick();
        }}
      >
        <span className="landing-header__logo">
          Ре<span className="landing-header__logo-accent">А</span>ктив
        </span>
        <span className="landing-header__subtitle">единый агрегатор лизинговой техники</span>
      </Link>

      <button
        className={`landing-header__burger${isMenuOpen ? " is-open" : ""}`}
        type="button"
        aria-expanded={isMenuOpen}
        aria-controls="public-site-nav"
        aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
        onClick={onToggleMenu}
      >
        <span />
        <span />
        <span />
      </button>

      <nav
        id="public-site-nav"
        className={`landing-header__nav${isMenuOpen ? " is-open" : ""}`}
        aria-label="Публичная навигация"
      >
        <Link
          to="/"
          className={catalogActive ? "is-active" : undefined}
          onClick={onCloseMenu}
        >
          Каталог техники
        </Link>
        <Link
          to="/landing"
          className={landingActive ? "is-active" : undefined}
          onClick={onCloseMenu}
        >
          О платформе
        </Link>
        <Link
          to="/partners"
          className={partnersActive ? "is-active" : undefined}
          onClick={onCloseMenu}
        >
          Партнёрам
        </Link>
        <Link to="/blog" className={blogActive ? "is-active" : undefined} onClick={onCloseMenu}>
          Блог
        </Link>
        <Link
          to="/login"
          state={{ activitySource: "public_site_header" }}
          className={loginActive ? "is-active" : undefined}
          onClick={onCloseMenu}
        >
          Личный кабинет для ЮЛ
        </Link>
      </nav>
    </header>
  );
}

function PublicSiteFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__line" aria-hidden />
      <div className="landing-footer__content">
        <p className="landing-footer__meta">
          <span className="landing-footer__brand">
            Ре<span className="landing-footer__brand-accent">А</span>ктив
          </span>{" "}
          | 2026
        </p>
        <div className="landing-footer__links">
          <PrivacyPolicyLink />
          <TermsLink />
        </div>
      </div>
    </footer>
  );
}

function resolveForcedTenantByHostname(hostname: string): string | undefined {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return undefined;
  }

  const mappedTenant = HOST_FORCED_TENANT_MAP[normalizedHostname];
  if (!mappedTenant) {
    return undefined;
  }

  const normalizedTenant = mappedTenant.trim().toLowerCase();
  return normalizedTenant || undefined;
}

function RouteLoadingScreen() {
  return (
    <div className="app-loading-screen" aria-live="polite" aria-label="Loading page">
      <div className="app-loading-screen__spinner" aria-hidden="true" />
    </div>
  );
}

export function App() {
  const location = useLocation();
  const forcedTenantForHost =
    typeof window !== "undefined"
      ? resolveForcedTenantByHostname(window.location.hostname)
      : undefined;
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [platformMode, setPlatformMode] = useState<PlatformModeState>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isPublicMenuOpen, setIsPublicMenuOpen] = useState(false);
  const hasLoggedSessionStartRef = useRef(false);
  const lastLoggedPageRef = useRef<string>("");

  const isAdmin = authUser?.role === "admin";
  const canViewActivity =
    isAdmin || (authUser?.login ? ACTIVITY_VIEWER_LOGINS.has(authUser.login.toLowerCase()) : false);
  const canAccessUpload = authUser?.role === "admin";
  const canAccessHighlights =
    authUser?.role === "admin" || authUser?.role === "stock_owner";
  const canAccessCatalog = isAdmin;
  const canAccessFavorites = Boolean(authUser);
  const showMainNav = isAdmin || canAccessUpload || canViewActivity || canAccessFavorites;
  const defaultAuthorizedPath = canAccessUpload ? "/upload" : "/";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const pathname = normalizePublicPathname(location.pathname);
    const passengerBrandPage = resolvePublicBrandPageByPathname(pathname);
    const isLandingPath = pathname === "/landing";
    const isPartnersPath = pathname === "/partners" || pathname.startsWith("/partners/");
    const isBlogListPath = pathname === "/blog";
    const blogSlug = extractBlogSlug(pathname);
    const blogArticle = blogSlug ? getBlogArticleBySlug(blogSlug) : undefined;
    const isKnownBlogArticlePath = Boolean(blogArticle);
    const isUnknownBlogArticlePath = blogSlug !== null && !blogArticle;
    const isShowcasePath = pathname === "/" || pathname === "/showcase" || Boolean(passengerBrandPage);
    const isServicePath =
      pathname === "/login" ||
      pathname === HIDDEN_ADMIN_LOGIN_PATH ||
      pathname === "/upload" ||
      pathname === "/catalog" ||
      pathname === "/favorites" ||
      pathname.startsWith("/admin");
    const isItemPage = pathname.startsWith("/showcase/");

    let canonicalPath = pathname === "/showcase" ? "/" : pathname;

    let title = PUBLIC_TITLE;
    let description = CATALOG_SEO_DESCRIPTION;
    let robots = "index, follow, max-image-preview:large";

    if (isServicePath) {
      title = "ReActiv";
      robots = "noindex, nofollow";
    } else if (isUnknownBlogArticlePath) {
      title = BLOG_SEO_TITLE;
      description = BLOG_SEO_DESCRIPTION;
      robots = "noindex, nofollow";
      canonicalPath = "/blog";
    } else if (isKnownBlogArticlePath && blogArticle) {
      title = blogArticle.seoTitle;
      description = blogArticle.seoDescription;
      canonicalPath = `/blog/${blogArticle.slug}`;
    } else if (isItemPage) {
      title = "Карточка лота — РеАктив";
      description =
        "Подробная карточка техники: фото, характеристики, цена и расположение.";
    } else if (passengerBrandPage) {
      title = `${passengerBrandPage.name} после лизинга — каталог авто Reactiv`;
      description = `Подборка лотов ${passengerBrandPage.name} после лизинга: актуальные предложения с фото, ценой и характеристиками на платформе Reactiv.`;
    } else if (isLandingPath) {
      title = LANDING_SEO_TITLE;
      description = LANDING_SEO_DESCRIPTION;
    } else if (isPartnersPath) {
      title = PARTNERS_SEO_TITLE;
      description = PARTNERS_SEO_DESCRIPTION;
    } else if (isBlogListPath) {
      title = BLOG_SEO_TITLE;
      description = BLOG_SEO_DESCRIPTION;
    } else if (isShowcasePath) {
      title = CATALOG_SEO_TITLE;
      description = CATALOG_SEO_DESCRIPTION;
    }

    const resolvedCanonicalUrl = `${SEO_WEB_BASE_URL}${canonicalPath}`;

    document.title = title;
    upsertMetaByName("robots", robots);
    upsertMetaByName("keywords", SEO_KEYWORDS);
    upsertMetaByName("description", description);
    upsertMetaByName("twitter:title", title);
    upsertMetaByName("twitter:description", description);
    upsertMetaByProperty("og:title", title);
    upsertMetaByProperty("og:description", description);
    upsertMetaByProperty("og:url", resolvedCanonicalUrl);
    upsertCanonicalLink(resolvedCanonicalUrl);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      const [modeResult, authResult] = await Promise.allSettled([
        getPlatformMode(),
        getCurrentUser(),
      ]);

      if (!isMounted) {
        return;
      }

      if (modeResult.status === "fulfilled") {
        setPlatformMode(modeResult.value.mode);
      } else {
        setPlatformMode("closed");
      }

      if (authResult.status === "fulfilled") {
        setAuthUser(authResult.value.user);
        setAuthState("authorized");
      } else {
        setAuthUser(null);
        setAuthState("unauthorized");
      }
    }

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (authState !== "authorized" || hasLoggedSessionStartRef.current) {
      return;
    }

    hasLoggedSessionStartRef.current = true;
    void logActivityEvent({
      eventType: "session_start",
      page: typeof window !== "undefined" ? window.location.pathname : "/",
      payload: {
        role: authUser?.role ?? null,
      },
    });
  }, [authState, authUser?.role]);

  useEffect(() => {
    if (authState !== "authorized") {
      hasLoggedSessionStartRef.current = false;
      lastLoggedPageRef.current = "";
      return;
    }

    const intervalId = window.setInterval(() => {
      void logActivityEvent({
        eventType: "session_heartbeat",
        page: window.location.pathname,
      });
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authState]);

  useEffect(() => {
    if (authState !== "authorized") {
      return;
    }

    const pageKey = `${location.pathname}${location.search}`;
    if (lastLoggedPageRef.current === pageKey) {
      return;
    }

    lastLoggedPageRef.current = pageKey;
    void logActivityEvent({
      eventType: "page_view",
      page: location.pathname,
      payload: {
        search: location.search || null,
      },
    });
  }, [authState, location.pathname, location.search]);

  useEffect(() => {
    setIsPublicMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    const isBlogArticlePath = location.pathname.startsWith("/blog/");
    const isPartnersPath = location.pathname === "/partners" || location.pathname.startsWith("/partners/");
    document.body.classList.toggle("blog-article-route", isBlogArticlePath);
    document.body.classList.toggle("partners-route", isPartnersPath);

    return () => {
      document.body.classList.remove("blog-article-route");
      document.body.classList.remove("partners-route");
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isPublicMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPublicMenuOpen]);

  async function handleLogout(): Promise<void> {
    try {
      void logActivityEvent({
        eventType: "logout",
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      });
      await logout();
    } finally {
      setAuthUser(null);
      setAuthState("unauthorized");
    }
  }

  function handlePublicBrandClick(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.removeItem("showcase_ui_state_v1");
      window.sessionStorage.removeItem("showcase_return_pending_v1");
      window.sessionStorage.removeItem("showcase_scroll_y_v1");
    } catch {
      // ignore storage errors
    }

    window.dispatchEvent(new Event("reactiv:showcase-reset-filters"));
  }

  if (authState === "checking" || platformMode === "checking") {
    return (
      <div className="app-loading-screen" aria-live="polite" aria-label="Loading session">
        <div className="app-loading-screen__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (authState === "unauthorized") {
    const loginElement = (
      <LoginPage
        onLoginSuccess={(user) => {
          setAuthUser(user);
          setAuthState("authorized");
        }}
      />
    );

    if (platformMode === "open") {
      const showPublicLayout = isPublicLayoutPath(location.pathname);

      return (
        <>
          <div className={showPublicLayout ? "app app--public" : "app"}>
            {showPublicLayout && (
              <PublicSiteHeader
                pathname={location.pathname}
                isMenuOpen={isPublicMenuOpen}
                onToggleMenu={() => setIsPublicMenuOpen((prev) => !prev)}
                onCloseMenu={() => setIsPublicMenuOpen(false)}
                onBrandClick={handlePublicBrandClick}
              />
            )}

            <Suspense fallback={<RouteLoadingScreen />}>
              <Routes>
                <Route
                  path="/"
                  element={<ShowcasePage publicMode forcedTenant={forcedTenantForHost} />}
                />
                {PUBLIC_BRAND_PAGES.map((brand) => (
                  <Route
                    key={brand.slug}
                    path={`/${brand.slug}`}
                    element={
                      <ShowcasePage
                        publicMode
                        forcedTenant={forcedTenantForHost}
                        forcedBrand={brand.filterBrand}
                        forcedBrandAliases={brand.filterBrandAliases}
                      />
                    }
                  />
                ))}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/partners" element={<PartnersPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogArticlePage />} />
                <Route path="/showcase" element={<Navigate to="/" replace />} />
                <Route
                  path="/showcase/:itemId"
                  element={<ShowcaseItemPage forcedTenantId={forcedTenantForHost} />}
                />
                <Route path={HIDDEN_ADMIN_LOGIN_PATH} element={loginElement} />
                <Route path="/login" element={loginElement} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            {showPublicLayout ? <PublicSiteFooter /> : <PublicLegalFooter />}
          </div>
          <FeedbackWidget />
        </>
      );
    }

    return (
      <>
        <div className="app app--public">
          <PublicSiteHeader
            pathname={location.pathname}
            isMenuOpen={isPublicMenuOpen}
            onToggleMenu={() => setIsPublicMenuOpen((prev) => !prev)}
            onCloseMenu={() => setIsPublicMenuOpen(false)}
            onBrandClick={handlePublicBrandClick}
          />
          <Routes>
            <Route path="/login" element={loginElement} />
            <Route path={HIDDEN_ADMIN_LOGIN_PATH} element={loginElement} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <PublicSiteFooter />
        </div>
        <FeedbackWidget />
      </>
    );
  }

  return (
    <>
      <div className="app">
        <div className={`nav-wrap${showMainNav ? "" : " nav-wrap--actions-only"}`}>
          {showMainNav && (
            <nav className="nav">
            {canAccessUpload && (
              <NavLink to="/upload" className={({ isActive }) => (isActive ? "active" : "")}>
                Загрузка
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/catalog" className={({ isActive }) => (isActive ? "active" : "")}>
                Каталог
              </NavLink>
            )}
            <NavLink to="/showcase" className={({ isActive }) => (isActive ? "active" : "")}>
              Витрина
            </NavLink>
            <NavLink to="/favorites" className={({ isActive }) => (isActive ? "active" : "")}>
              Избранное
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
                Пользователи
              </NavLink>
            )}
            {canAccessHighlights && (
              <NavLink to="/admin/highlights" className={({ isActive }) => (isActive ? "active" : "")}>
                Highlights
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin/operations" className={({ isActive }) => (isActive ? "active" : "")}>
                Operations
              </NavLink>
            )}
              {canViewActivity && (
                <NavLink to="/admin/activity" className={({ isActive }) => (isActive ? "active" : "")}>
                  Активность
                </NavLink>
              )}
            </nav>
          )}
          <div className="nav-actions">
            <span className="nav-user">{authUser?.displayName ?? authUser?.login}</span>
            <button
              type="button"
              className="secondary-button nav-logout"
              onClick={() => void handleLogout()}
            >
              Выйти
            </button>
          </div>
        </div>
        <Suspense fallback={<RouteLoadingScreen />}>
          <Routes>
            <Route
              path="/"
              element={canAccessUpload ? <Navigate to="/upload" replace /> : <ShowcasePage />}
            />
            <Route
              path="/showcase"
              element={<ShowcasePage canFilterByTenant={isAdmin} />}
            />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route
              path="/upload"
              element={
                canAccessUpload ? (
                  <UploadPage canAccessCatalog={canAccessCatalog} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/catalog"
              element={isAdmin ? <CatalogPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="/showcase/:itemId"
              element={<ShowcaseItemPage allowFavorites showTenantInfo={isAdmin} />}
            />
            <Route
              path="/admin/users"
              element={isAdmin ? <AdminUsersPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="/admin/highlights"
              element={
                canAccessHighlights ? (
                  <AdminHighlightsPage userRole={authUser?.role} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/admin/operations"
              element={isAdmin ? <AdminOperationsPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="/admin/activity"
              element={canViewActivity ? <AdminActivityPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="/login"
              element={<Navigate to={defaultAuthorizedPath} replace />}
            />
            <Route
              path={HIDDEN_ADMIN_LOGIN_PATH}
              element={<Navigate to={defaultAuthorizedPath} replace />}
            />
            <Route path="*" element={<Navigate to={defaultAuthorizedPath} replace />} />
          </Routes>
        </Suspense>
      </div>
      <FeedbackWidget />
    </>
  );
}
