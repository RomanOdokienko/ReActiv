import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createAdminUser, getAdminUsers } from "../api/client";
import type { AdminUserListItem, UserRole } from "../types/api";

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [login, setLogin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("manager");

  async function loadUsers() {
    try {
      setError(null);
      const response = await getAdminUsers();
      setUsers(response.items);
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message === "FORBIDDEN") {
        setError("Доступ к управлению пользователями разрешен только администратору.");
        return;
      }

      if (caughtError instanceof Error) {
        setError(caughtError.message);
        return;
      }

      setError("Не удалось загрузить пользователей");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedLogin = login.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();

    if (!normalizedLogin || !normalizedDisplayName || !password.trim()) {
      setError("Заполните логин, имя и пароль.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createAdminUser({
        login: normalizedLogin,
        password,
        displayName: normalizedDisplayName,
        role,
      });

      setSuccess(`Пользователь ${normalizedLogin} создан.`);
      setLogin("");
      setDisplayName("");
      setPassword("");
      setRole("manager");
      await loadUsers();
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message === "FORBIDDEN") {
        setError("Доступ к управлению пользователями разрешен только администратору.");
        return;
      }

      if (caughtError instanceof Error) {
        setError(caughtError.message);
        return;
      }

      setError("Не удалось создать пользователя");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Пользователи</h1>

      <form className="panel upload-form admin-users-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Логин"
          autoComplete="off"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
        />
        <input
          type="text"
          placeholder="Отображаемое имя"
          autoComplete="off"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <input
          type="password"
          placeholder="Пароль (мин. 8 символов)"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
        >
          <option value="manager">Менеджер</option>
          <option value="admin">Администратор</option>
        </select>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создание..." : "Создать пользователя"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="panel recent-imports">
        <h2>Список пользователей</h2>
        {isLoading ? (
          <p>Загрузка пользователей...</p>
        ) : users.length === 0 ? (
          <p className="empty">Пользователей пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Логин</th>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Создан</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.login}</td>
                    <td>{user.displayName}</td>
                    <td>{user.role === "admin" ? "Администратор" : "Менеджер"}</td>
                    <td>{user.isActive ? "Активен" : "Отключен"}</td>
                    <td>{user.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
