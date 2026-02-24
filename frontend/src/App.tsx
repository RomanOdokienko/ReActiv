import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { getCurrentUser, logout } from "./api/client";
import { CatalogPage } from "./pages/CatalogPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { LoginPage } from "./pages/LoginPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { ShowcaseItemPage } from "./pages/ShowcaseItemPage";
import { UploadPage } from "./pages/UploadPage";
import type { AuthUser } from "./types/api";

type AuthState = "checking" | "authorized" | "unauthorized";

const CATALOG_RESTRICTED_LOGINS = new Set(["alexey"]);

export function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const canAccessCatalog = authUser
    ? !CATALOG_RESTRICTED_LOGINS.has(authUser.login.trim().toLowerCase())
    : false;
  const isAdmin = authUser?.role === "admin";

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

  async function handleLogout(): Promise<void> {
    try {
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
          <NavLink to="/upload" className={({ isActive }) => (isActive ? "active" : "")}>Загрузка</NavLink>
          {canAccessCatalog && (
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
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<UploadPage canAccessCatalog={canAccessCatalog} />} />
        <Route
          path="/catalog"
          element={canAccessCatalog ? <CatalogPage /> : <Navigate to="/upload" replace />}
        />
        <Route path="/showcase" element={<ShowcasePage />} />
        <Route path="/showcase/:itemId" element={<ShowcaseItemPage />} />
        <Route
          path="/admin/users"
          element={isAdmin ? <AdminUsersPage /> : <Navigate to="/upload" replace />}
        />
        <Route path="/login" element={<Navigate to="/upload" replace />} />
      </Routes>
    </div>
  );
}
