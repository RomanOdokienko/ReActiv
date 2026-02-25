import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  getCurrentUser,
  resetAdminUserPassword,
  updateAdminUserMeta,
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

function optionalValue(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function textOrDash(value: string | null): string {
  return value && value.trim().length > 0 ? value : "-";
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [login, setLogin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("manager");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

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

  useEffect(() => {
    if (!selectedUser) {
      setEditCompany("");
      setEditPhone("");
      setEditNotes("");
      return;
    }

    setEditCompany(selectedUser.company ?? "");
    setEditPhone(selectedUser.phone ?? "");
    setEditNotes(selectedUser.notes ?? "");
  }, [selectedUser]);

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
        company: optionalValue(company),
        phone: optionalValue(phone),
        notes: optionalValue(notes),
        role,
      });

      setSuccess(`Пользователь ${normalizedLogin} создан.`);
      setLogin("");
      setDisplayName("");
      setPassword("");
      setRole("manager");
      setCompany("");
      setPhone("");
      setNotes("");
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

  async function handleResetSelectedUserPassword() {
    if (!selectedUser) {
      setError("Выберите пользователя для сброса пароля.");
      return;
    }

    if (selectedUser.id === currentUserId) {
      setError("Нельзя сбросить пароль текущего пользователя через эту форму.");
      return;
    }

    const isConfirmed = window.confirm(
      `Сбросить пароль пользователя ${selectedUser.login}?`,
    );
    if (!isConfirmed) {
      return;
    }

    setIsResetting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await resetAdminUserPassword(selectedUser.id);
      setSuccess(
        `Новый временный пароль для ${response.user.login}: ${response.temporaryPassword}`,
      );
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

      setError("Не удалось сбросить пароль пользователя");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleSaveSelectedUserMeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUser) {
      setError("Выберите пользователя.");
      return;
    }

    setIsSavingMeta(true);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminUserMeta(selectedUser.id, {
        company: optionalValue(editCompany),
        phone: optionalValue(editPhone),
        notes: optionalValue(editNotes),
      });
      setSuccess(`Данные пользователя ${selectedUser.login} сохранены.`);
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

      setError("Не удалось сохранить данные пользователя");
    } finally {
      setIsSavingMeta(false);
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
        <input
          type="text"
          placeholder="Компания (опционально)"
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
        <input
          type="text"
          placeholder="Телефон (опционально)"
          autoComplete="off"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <textarea
          placeholder="Свободное поле (опционально)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создание..." : "Создать пользователя"}
        </button>
      </form>

      <div className="panel admin-users-delete">
        <h2>Действия с пользователем</h2>
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
            disabled={
              isResetting ||
              isDeleting ||
              !selectedUser ||
              selectedUser.id === currentUserId
            }
            onClick={() => void handleResetSelectedUserPassword()}
          >
            {isResetting ? "Сброс пароля..." : "Сбросить пароль выбранного"}
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={
              isDeleting ||
              isResetting ||
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

      <form className="panel upload-form admin-users-meta-form" onSubmit={handleSaveSelectedUserMeta}>
        <h2>Данные пользователя</h2>
        <input
          type="text"
          placeholder="Компания"
          autoComplete="off"
          value={editCompany}
          onChange={(event) => setEditCompany(event.target.value)}
          disabled={!selectedUser}
        />
        <input
          type="text"
          placeholder="Телефон"
          autoComplete="off"
          value={editPhone}
          onChange={(event) => setEditPhone(event.target.value)}
          disabled={!selectedUser}
        />
        <textarea
          placeholder="Свободное поле"
          value={editNotes}
          onChange={(event) => setEditNotes(event.target.value)}
          disabled={!selectedUser}
        />
        <button type="submit" disabled={isSavingMeta || !selectedUser}>
          {isSavingMeta ? "Сохранение..." : "Сохранить данные пользователя"}
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
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Логин</th>
                    <th>Имя</th>
                    <th>Роль</th>
                    <th>Компания</th>
                    <th>Телефон</th>
                    <th>Свободное поле</th>
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
                      <td>{textOrDash(user.company)}</td>
                      <td>{textOrDash(user.phone)}</td>
                      <td>{textOrDash(user.notes)}</td>
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
                      <dt className="mobile-card__label">Компания</dt>
                      <dd className="mobile-card__value">{textOrDash(user.company)}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Телефон</dt>
                      <dd className="mobile-card__value">{textOrDash(user.phone)}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Свободное поле</dt>
                      <dd className="mobile-card__value">{textOrDash(user.notes)}</dd>
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
