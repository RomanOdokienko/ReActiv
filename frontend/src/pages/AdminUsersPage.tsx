import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  getCurrentUser,
} from "../api/client";
import type { AdminUserListItem, UserRole } from "../types/api";

function roleLabel(role: UserRole): string {
  if (role === "admin") {
    return "Администратор";
  }
  if (role === "stock_owner") {
    return "Владелец стока";
  }
  return "Менеджер";
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [login, setLogin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("manager");

  const selectedUser = useMemo(
    () => users.find((item) => String(item.id) === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  async function loadUsers() {
    const response = await getAdminUsers();
    setUsers(response.items);
    setSelectedUserId((prev) => {
      if (prev && response.items.some((item) => String(item.id) === prev)) {
        return prev;
      }
      return response.items.length > 0 ? String(response.items[0].id) : "";
    });
  }

  async function initializePage() {
    try {
      setError(null);
      const [usersResponse, meResponse] = await Promise.all([
        getAdminUsers(),
        getCurrentUser(),
      ]);

      setUsers(usersResponse.items);
      setCurrentUserId(meResponse.user.id);
      setSelectedUserId(usersResponse.items.length > 0 ? String(usersResponse.items[0].id) : "");
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
    void initializePage();
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

  async function handleDeleteSelectedUser() {
    if (!selectedUser) {
      setError("Выберите пользователя для удаления.");
      return;
    }

    if (selectedUser.id === currentUserId) {
      setError("Нельзя удалить текущего пользователя.");
      return;
    }

    const isConfirmed = window.confirm(
      `Удалить пользователя ${selectedUser.login}?`,
    );
    if (!isConfirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteAdminUser(selectedUser.id);
      setSuccess(`Пользователь ${selectedUser.login} удален.`);
      await loadUsers();
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message === "FORBIDDEN") {
        setError("Доступ к управлению пользователями разрешен только администратору.");
        return;
      }

      if (caughtError instanceof Error && caughtError.message === "USER_NOT_FOUND") {
        setError("Пользователь уже удален.");
        await loadUsers();
        return;
      }

      if (caughtError instanceof Error) {
        setError(caughtError.message);
        return;
      }

      setError("Не удалось удалить пользователя");
    } finally {
      setIsDeleting(false);
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
          <option value="stock_owner">Владелец стока</option>
          <option value="admin">Администратор</option>
        </select>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создание..." : "Создать пользователя"}
        </button>
      </form>

      <div className="panel admin-users-delete">
        <h2>Удаление пользователя</h2>
        <div className="upload-form">
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={users.length === 0}
          >
            {users.length === 0 ? (
              <option value="">Пользователей нет</option>
            ) : (
              users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.login} - {roleLabel(user.role)}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            className="danger-button"
            disabled={
              isDeleting ||
              !selectedUser ||
              selectedUser.id === currentUserId
            }
            onClick={() => void handleDeleteSelectedUser()}
          >
            {isDeleting ? "Удаление..." : "Удалить выбранного"}
          </button>
        </div>
        {selectedUser && selectedUser.id === currentUserId && (
          <p className="empty">Текущего пользователя удалить нельзя.</p>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="panel recent-imports">
        <h2>Список пользователей</h2>
        {isLoading ? (
          <p>Загрузка пользователей...</p>
        ) : users.length === 0 ? (
          <p className="empty">Пользователей пока нет.</p>
        ) : (
          <>
          <div className="table-wrap desktop-table">
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
                    <td>{roleLabel(user.role)}</td>
                    <td>{user.isActive ? "Активен" : "Отключен"}</td>
                    <td>{user.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-cards">
            {users.map((user) => (
              <article key={`mobile-${user.id}`} className="mobile-card">
                <div className="mobile-card__head">
                  <strong>{user.login}</strong>
                  <span className="mobile-card__meta">{user.createdAt}</span>
                </div>
                <dl className="mobile-card__list">
                  <div className="mobile-card__row">
                    <dt className="mobile-card__label">Имя</dt>
                    <dd className="mobile-card__value">{user.displayName}</dd>
                  </div>
                  <div className="mobile-card__row">
                    <dt className="mobile-card__label">Роль</dt>
                    <dd className="mobile-card__value">{roleLabel(user.role)}</dd>
                  </div>
                  <div className="mobile-card__row">
                    <dt className="mobile-card__label">Статус</dt>
                    <dd className="mobile-card__value">
                      {user.isActive ? "Активен" : "Отключен"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          </>
        )}
      </div>
    </section>
  );
}
