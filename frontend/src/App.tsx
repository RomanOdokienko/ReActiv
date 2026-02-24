import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { getCurrentUser, logActivityEvent, logout } from "./api/client";
import { CatalogPage } from "./pages/CatalogPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { LoginPage } from "./pages/LoginPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { ShowcaseItemPage } from "./pages/ShowcaseItemPage";
import { UploadPage } from "./pages/UploadPage";
import type { AuthUser } from "./types/api";

type AuthState = "checking" | "authorized" | "unauthorized";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const hasLoggedSessionStartRef = useRef(false);

  const isAdmin = authUser?.role === "admin";
  const canAccessUpload =
    authUser?.role === "admin" || authUser?.role === "stock_owner";
  const canAccessCatalog = isAdmin;

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await getCurrentUser();
        setAuthUser(response.user);
        setAuthState("authorized");
      } catch {
        setAuthUser(null);
        setAuthState("unauthorized");
      }
    }

    void checkSession();
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

  if (authState === "checking") {
    return (
      <div className="app">
        <div className="panel">
          <h2>Проверка сессии...</h2>
        </div>
      </div>
    );
  }

  if (authState === "unauthorized") {
    return (
      <div className="app">
        <Routes>
          <Route
            path="/login"
            element={
              <LoginPage
                onLoginSuccess={(user) => {
                  setAuthUser(user);
                  setAuthState("authorized");
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="nav-wrap">
        <nav className="nav">
          {canAccessUpload && (
            <NavLink to="/upload" className={({ isActive }) => (isActive ? "active" : "")}>Загрузка</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/catalog" className={({ isActive }) => (isActive ? "active" : "")}>Каталог</NavLink>
          )}
          <NavLink to="/showcase" className={({ isActive }) => (isActive ? "active" : "")}>Витрина</NavLink>
          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>Пользователи</NavLink>
          )}
        </nav>
        <div className="nav-actions">
          <span className="nav-user">{authUser?.displayName ?? authUser?.login}</span>
          <button type="button" className="secondary-button nav-logout" onClick={() => void handleLogout()}>
            Выйти
          </button>
        </div>
      </div>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={canAccessUpload ? "/upload" : "/showcase"} replace />}
        />
        <Route
          path="/upload"
          element={canAccessUpload ? <UploadPage canAccessCatalog={canAccessCatalog} /> : <Navigate to="/showcase" replace />}
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
          path="/login"
          element={<Navigate to={canAccessUpload ? "/upload" : "/showcase"} replace />}
        />
      </Routes>
    </div>
  );
}
