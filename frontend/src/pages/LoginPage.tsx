import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { logActivityEvent, login } from "../api/client";
import type { AuthUser } from "../types/api";

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const location = useLocation();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("auth-page");
    return () => {
      document.body.classList.remove("auth-page");
    };
  }, []);

  useEffect(() => {
    const stateSource =
      (location.state as { activitySource?: string } | null)?.activitySource ?? null;

    void logActivityEvent({
      eventType: "login_open",
      page: location.pathname,
      payload: {
        source: stateSource ?? "direct",
      },
    });
  }, [location.pathname, location.state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!loginValue.trim() || !password) {
      setError("Введите логин и пароль");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login(loginValue.trim(), password);
      onLoginSuccess(response.user);
      void logActivityEvent({
        eventType: "login_success",
        page: "/login",
        payload: {
          login: response.user.login,
          role: response.user.role,
        },
      });
    } catch (caughtError) {
      void logActivityEvent({
        eventType: "login_failed",
        page: location.pathname,
        payload: {
          loginAttempt: loginValue.trim() || null,
          message:
            caughtError instanceof Error ? caughtError.message.slice(0, 160) : "unknown_error",
        },
      });

      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("Ошибка входа");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout auth-layout--landing">
      <div className="auth-shell">
        <p className="auth-top-logo">
          Ре<span>Актив</span>
        </p>

        <div className="auth-landing-grid">
          <div className="panel auth-panel auth-panel--landing">
            <h1>Личный кабинет</h1>
            <form className="auth-form auth-form--landing" onSubmit={handleSubmit}>
              <label className="field">
                <span>Логин</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={loginValue}
                  onChange={(event) => setLoginValue(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Пароль</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Вход..." : "Войти"}
              </button>
              <a
                className="auth-request-button auth-request-button--landing"
                href="https://t.me/romanodokienko"
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  void logActivityEvent({
                    eventType: "showcase_contact_click",
                    page: location.pathname,
                    payload: {
                      source: "login_request_access",
                      channel: "telegram",
                    },
                  });
                }}
              >
                Запросить доступ к платформе
              </a>
            </form>
            {error && <p className="error">{error}</p>}
          </div>

          <aside className="auth-promo-card" aria-label="Преимущества платформы">
            <div className="auth-promo-card__image" aria-hidden="true" />
            <h2>Единый агрегатор изъятой лизинговой техники</h2>
            <ul className="auth-promo-list">
              <li>
                <strong>Лизинговым компаниям</strong>
                <p>Витрина для размещения и реализации стока</p>
              </li>
              <li>
                <strong>Дилерам, юрлицам и агентам</strong>
                <p>Прямой доступ к актуальной базе изъятой техники от крупных компаний РФ</p>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
