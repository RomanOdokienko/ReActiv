import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "../api/client";
import type { AuthUser } from "../types/api";

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (caughtError) {
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
    <section className="auth-layout">
      <div className="panel auth-panel">
        <div className="auth-brand">
          <p className="auth-brand__name">
            Ре<span>Актив</span>
          </p>
          <p className="auth-brand__tagline">
            Доступ к лизинговым лотам для профессионалов
          </p>
        </div>
        <h1>Вход в кабинет</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
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
            {isSubmitting ? "Входим..." : "Войти"}
          </button>
          <a
            className="auth-request-button"
            href="https://t.me/romanodokienko"
            target="_blank"
            rel="noreferrer"
          >
            Запросить доступ на платформу
          </a>
        </form>
        <p className="auth-note">Только для авторизованных партнеров и сотрудников.</p>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
