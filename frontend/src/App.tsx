import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  getCurrentUser,
  getPlatformMode,
  logActivityEvent,
  logout,
} from "./api/client";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { CatalogPage } from "./pages/CatalogPage";
import { AdminActivityPage } from "./pages/AdminActivityPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { LoginPage } from "./pages/LoginPage";
import { ShowcaseItemPage } from "./pages/ShowcaseItemPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { UploadPage } from "./pages/UploadPage";
import type { AuthUser, PlatformMode } from "./types/api";

type AuthState = "checking" | "authorized" | "unauthorized";
type PlatformModeState = "checking" | PlatformMode;

const HIDDEN_ADMIN_LOGIN_PATH = "/staff-login-reactiv";

export function App() {
  const location = useLocation();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [platformMode, setPlatformMode] = useState<PlatformModeState>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const hasLoggedSessionStartRef = useRef(false);
  const lastLoggedPageRef = useRef<string>("");

  const isAdmin = authUser?.role === "admin";
  const canAccessUpload =
    authUser?.role === "admin" || authUser?.role === "stock_owner";
  const canAccessCatalog = isAdmin;
  const defaultAuthorizedPath = canAccessUpload ? "/upload" : "/showcase";

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

  if (authState === "checking" || platformMode === "checking") {
    return (
      <>
        <div className="app">
          <div className="panel">
            <h2>Проверка сессии...</h2>
          </div>
        </div>
        <FeedbackWidget />
      </>
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
      return (
        <>
          <div className="app">
            <Routes>
              <Route path="/" element={<Navigate to="/showcase" replace />} />
              <Route path="/showcase" element={<ShowcasePage />} />
              <Route path="/showcase/:itemId" element={<ShowcaseItemPage />} />
              <Route path={HIDDEN_ADMIN_LOGIN_PATH} element={loginElement} />
              <Route path="/login" element={<Navigate to="/showcase" replace />} />
              <Route path="*" element={<Navigate to="/showcase" replace />} />
            </Routes>
          </div>
          <FeedbackWidget />
        </>
      );
    }

    return (
      <>
        <div className="app">
          <Routes>
            <Route path="/login" element={loginElement} />
            <Route path={HIDDEN_ADMIN_LOGIN_PATH} element={loginElement} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
        <FeedbackWidget />
      </>
    );
  }

  return (
    <>
      <div className="app">
        <div className="nav-wrap">
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
            {isAdmin && (
              <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
                Пользователи
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin/activity" className={({ isActive }) => (isActive ? "active" : "")}>
                Активность
              </NavLink>
            )}
          </nav>
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
        <Routes>
          <Route
            path="/"
            element={<Navigate to={defaultAuthorizedPath} replace />}
          />
          <Route
            path="/upload"
            element={
              canAccessUpload ? (
                <UploadPage canAccessCatalog={canAccessCatalog} />
              ) : (
                <Navigate to="/showcase" replace />
              )
            }
          />
          <Route
            path="/catalog"
            element={isAdmin ? <CatalogPage /> : <Navigate to="/showcase" replace />}
          />
          <Route path="/showcase" element={<ShowcasePage />} />
          <Route path="/showcase/:itemId" element={<ShowcaseItemPage />} />
          <Route
            path="/admin/users"
            element={isAdmin ? <AdminUsersPage /> : <Navigate to="/showcase" replace />}
          />
          <Route
            path="/admin/activity"
            element={isAdmin ? <AdminActivityPage /> : <Navigate to="/showcase" replace />}
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
      </div>
      <FeedbackWidget />
    </>
  );
}
