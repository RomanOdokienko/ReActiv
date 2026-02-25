import { useEffect, useMemo, useState } from "react";
import {
  getAdminActivity,
  getAdminGuestActivity,
} from "../api/client";
import type {
  ActivityEventItem,
  ActivityEventType,
  GuestActivityEventItem,
} from "../types/api";

const EVENT_TYPE_OPTIONS: Array<{ value: "" | ActivityEventType; label: string }> = [
  { value: "", label: "Все события" },
  { value: "login_success", label: "Вход" },
  { value: "logout", label: "Выход" },
  { value: "session_start", label: "Старт сессии" },
  { value: "session_heartbeat", label: "Heartbeat" },
  { value: "page_view", label: "Просмотр страницы" },
  { value: "showcase_open", label: "Открытие витрины" },
  { value: "showcase_filters_apply", label: "Применение фильтров" },
  { value: "showcase_page_change", label: "Смена страницы витрины" },
  { value: "showcase_item_open", label: "Открытие карточки" },
  { value: "showcase_contact_click", label: "Клик по контакту" },
  { value: "showcase_source_open", label: "Открытие источника" },
  { value: "api_error", label: "Ошибка API" },
];

interface AppliedUserFilters {
  login: string;
  userId: string;
  eventType: "" | ActivityEventType;
  from: string;
  to: string;
}

interface AppliedGuestFilters {
  sessionId: string;
  eventType: "" | ActivityEventType;
  from: string;
  to: string;
}

function eventTypeLabel(eventType: ActivityEventType): string {
  const found = EVENT_TYPE_OPTIONS.find((item) => item.value === eventType);
  return found?.label ?? eventType;
}

function formatPayload(payload: Record<string, unknown> | null): string {
  if (!payload) {
    return "-";
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return "-";
  }
}

function formatEntity(entityType: string | null, entityId: string | null): string {
  if (!entityType) {
    return "-";
  }

  return entityId ? `${entityType}:${entityId}` : entityType;
}

function textOrDash(value: string | null): string {
  return value && value.trim().length > 0 ? value : "-";
}

export function AdminActivityPage() {
  const [items, setItems] = useState<ActivityEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const [loginInput, setLoginInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [eventTypeInput, setEventTypeInput] = useState<"" | ActivityEventType>("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const [appliedFilters, setAppliedFilters] = useState<AppliedUserFilters>({
    login: "",
    userId: "",
    eventType: "",
    from: "",
    to: "",
  });

  const [guestItems, setGuestItems] = useState<GuestActivityEventItem[]>([]);
  const [isGuestLoading, setIsGuestLoading] = useState(true);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestPage, setGuestPage] = useState(1);
  const [guestTotal, setGuestTotal] = useState(0);
  const [guestPageSize] = useState(50);

  const [guestSessionInput, setGuestSessionInput] = useState("");
  const [guestEventTypeInput, setGuestEventTypeInput] = useState<"" | ActivityEventType>("");
  const [guestFromInput, setGuestFromInput] = useState("");
  const [guestToInput, setGuestToInput] = useState("");

  const [appliedGuestFilters, setAppliedGuestFilters] = useState<AppliedGuestFilters>({
    sessionId: "",
    eventType: "",
    from: "",
    to: "",
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const guestTotalPages = Math.max(1, Math.ceil(guestTotal / guestPageSize));
  const canGoGuestPrev = guestPage > 1;
  const canGoGuestNext = guestPage < guestTotalPages;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.login) {
      count += 1;
    }
    if (appliedFilters.userId) {
      count += 1;
    }
    if (appliedFilters.eventType) {
      count += 1;
    }
    if (appliedFilters.from) {
      count += 1;
    }
    if (appliedFilters.to) {
      count += 1;
    }
    return count;
  }, [appliedFilters]);

  const activeGuestFilterCount = useMemo(() => {
    let count = 0;
    if (appliedGuestFilters.sessionId) {
      count += 1;
    }
    if (appliedGuestFilters.eventType) {
      count += 1;
    }
    if (appliedGuestFilters.from) {
      count += 1;
    }
    if (appliedGuestFilters.to) {
      count += 1;
    }
    return count;
  }, [appliedGuestFilters]);

  useEffect(() => {
    async function loadActivity() {
      setIsLoading(true);
      setError(null);

      try {
        const userId = appliedFilters.userId.trim();
        const userIdNumber = userId ? Number(userId) : undefined;

        const response = await getAdminActivity({
          page,
          pageSize,
          login: appliedFilters.login.trim() || undefined,
          userId:
            typeof userIdNumber === "number" && Number.isFinite(userIdNumber)
              ? userIdNumber
              : undefined,
          eventType: appliedFilters.eventType || undefined,
          from: appliedFilters.from || undefined,
          to: appliedFilters.to || undefined,
        });

        setItems(response.items);
        setTotal(response.pagination.total);
      } catch (caughtError) {
        if (caughtError instanceof Error && caughtError.message === "FORBIDDEN") {
          setError("Доступ к журналу активности разрешен только администратору.");
          return;
        }

        if (caughtError instanceof Error) {
          setError(caughtError.message);
          return;
        }

        setError("Не удалось загрузить журнал активности.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadActivity();
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    async function loadGuestActivity() {
      setIsGuestLoading(true);
      setGuestError(null);

      try {
        const response = await getAdminGuestActivity({
          page: guestPage,
          pageSize: guestPageSize,
          sessionId: appliedGuestFilters.sessionId || undefined,
          eventType: appliedGuestFilters.eventType || undefined,
          from: appliedGuestFilters.from || undefined,
          to: appliedGuestFilters.to || undefined,
        });

        setGuestItems(response.items);
        setGuestTotal(response.pagination.total);
      } catch (caughtError) {
        if (caughtError instanceof Error && caughtError.message === "FORBIDDEN") {
          setGuestError("Доступ к гостевой активности разрешен только администратору.");
          return;
        }

        if (caughtError instanceof Error) {
          setGuestError(caughtError.message);
          return;
        }

        setGuestError("Не удалось загрузить гостевую активность.");
      } finally {
        setIsGuestLoading(false);
      }
    }

    void loadGuestActivity();
  }, [appliedGuestFilters, guestPage, guestPageSize]);

  function applyFilters(): void {
    setPage(1);
    setAppliedFilters({
      login: loginInput.trim(),
      userId: userIdInput.trim(),
      eventType: eventTypeInput,
      from: fromInput,
      to: toInput,
    });
  }

  function resetFilters(): void {
    setLoginInput("");
    setUserIdInput("");
    setEventTypeInput("");
    setFromInput("");
    setToInput("");
    setPage(1);
    setAppliedFilters({
      login: "",
      userId: "",
      eventType: "",
      from: "",
      to: "",
    });
  }

  function applyGuestFilters(): void {
    setGuestPage(1);
    setAppliedGuestFilters({
      sessionId: guestSessionInput.trim(),
      eventType: guestEventTypeInput,
      from: guestFromInput,
      to: guestToInput,
    });
  }

  function resetGuestFilters(): void {
    setGuestSessionInput("");
    setGuestEventTypeInput("");
    setGuestFromInput("");
    setGuestToInput("");
    setGuestPage(1);
    setAppliedGuestFilters({
      sessionId: "",
      eventType: "",
      from: "",
      to: "",
    });
  }

  return (
    <section>
      <h1>Активность пользователей и гостей</h1>

      <div className="panel">
        <h2>Активность авторизованных пользователей</h2>
        <div className="toolbar activity-toolbar">
          <input
            type="text"
            placeholder="Логин"
            value={loginInput}
            onChange={(event) => setLoginInput(event.target.value)}
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="User ID"
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value.replace(/[^\d]/g, ""))}
          />
          <select
            value={eventTypeInput}
            onChange={(event) => setEventTypeInput(event.target.value as "" | ActivityEventType)}
          >
            {EVENT_TYPE_OPTIONS.map((item) => (
              <option key={`user-${item.value || "all"}`} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={fromInput}
            onChange={(event) => setFromInput(event.target.value)}
          />
          <input
            type="datetime-local"
            value={toInput}
            onChange={(event) => setToInput(event.target.value)}
          />
          <button type="button" onClick={applyFilters}>
            Применить
          </button>
          <button type="button" className="secondary-button" onClick={resetFilters}>
            Сброс
          </button>
        </div>
        <p className="empty">
          Фильтров применено: {activeFilterCount}. Всего событий: {total.toLocaleString("ru-RU")}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {isLoading ? (
          <p>Загрузка активности...</p>
        ) : items.length === 0 ? (
          <p className="empty">События не найдены.</p>
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Пользователь</th>
                    <th>Событие</th>
                    <th>Страница</th>
                    <th>Сущность</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`user-event-${item.id}`}>
                      <td>{item.createdAt}</td>
                      <td>
                        {item.login} (#{item.userId})
                      </td>
                      <td>{eventTypeLabel(item.eventType)}</td>
                      <td>{item.page || "-"}</td>
                      <td>{formatEntity(item.entityType, item.entityId)}</td>
                      <td>
                        <code className="activity-payload">{formatPayload(item.payload)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards">
              {items.map((item) => (
                <article key={`user-mobile-${item.id}`} className="mobile-card">
                  <div className="mobile-card__head">
                    <strong>{eventTypeLabel(item.eventType)}</strong>
                    <span className="mobile-card__meta">{item.createdAt}</span>
                  </div>
                  <dl className="mobile-card__list">
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Пользователь</dt>
                      <dd className="mobile-card__value">{item.login} (#{item.userId})</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Страница</dt>
                      <dd className="mobile-card__value">{item.page || "-"}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Сущность</dt>
                      <dd className="mobile-card__value">{formatEntity(item.entityType, item.entityId)}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Payload</dt>
                      <dd className="mobile-card__value">
                        <code className="activity-payload">{formatPayload(item.payload)}</code>
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="pager pager--compact">
              <button
                className="pager-button pager-button--nav"
                type="button"
                disabled={!canGoPrev}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                ←
              </button>
              <span className="pager-mobile-status">
                Стр. {page} из {totalPages}
              </span>
              <button
                className="pager-button pager-button--nav"
                type="button"
                disabled={!canGoNext}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                →
              </button>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Гостевая активность</h2>
        <div className="toolbar activity-toolbar">
          <input
            type="text"
            placeholder="Session ID"
            value={guestSessionInput}
            onChange={(event) => setGuestSessionInput(event.target.value)}
          />
          <select
            value={guestEventTypeInput}
            onChange={(event) => setGuestEventTypeInput(event.target.value as "" | ActivityEventType)}
          >
            {EVENT_TYPE_OPTIONS.map((item) => (
              <option key={`guest-${item.value || "all"}`} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={guestFromInput}
            onChange={(event) => setGuestFromInput(event.target.value)}
          />
          <input
            type="datetime-local"
            value={guestToInput}
            onChange={(event) => setGuestToInput(event.target.value)}
          />
          <button type="button" onClick={applyGuestFilters}>
            Применить
          </button>
          <button type="button" className="secondary-button" onClick={resetGuestFilters}>
            Сброс
          </button>
        </div>
        <p className="empty">
          Фильтров применено: {activeGuestFilterCount}. Всего событий: {guestTotal.toLocaleString("ru-RU")}
        </p>
      </div>

      {guestError && <p className="error">{guestError}</p>}

      <div className="panel">
        {isGuestLoading ? (
          <p>Загрузка гостевой активности...</p>
        ) : guestItems.length === 0 ? (
          <p className="empty">Гостевые события не найдены.</p>
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Session</th>
                    <th>Событие</th>
                    <th>Страница</th>
                    <th>Сущность</th>
                    <th>UTM source</th>
                    <th>Referrer</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {guestItems.map((item) => (
                    <tr key={`guest-event-${item.id}`}>
                      <td>{item.createdAt}</td>
                      <td>{item.sessionId}</td>
                      <td>{eventTypeLabel(item.eventType)}</td>
                      <td>{item.page || "-"}</td>
                      <td>{formatEntity(item.entityType, item.entityId)}</td>
                      <td>{textOrDash(item.utmSource)}</td>
                      <td>{textOrDash(item.referrer)}</td>
                      <td>
                        <code className="activity-payload">{formatPayload(item.payload)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards">
              {guestItems.map((item) => (
                <article key={`guest-mobile-${item.id}`} className="mobile-card">
                  <div className="mobile-card__head">
                    <strong>{eventTypeLabel(item.eventType)}</strong>
                    <span className="mobile-card__meta">{item.createdAt}</span>
                  </div>
                  <dl className="mobile-card__list">
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Session</dt>
                      <dd className="mobile-card__value">{item.sessionId}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Страница</dt>
                      <dd className="mobile-card__value">{item.page || "-"}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">UTM source</dt>
                      <dd className="mobile-card__value">{textOrDash(item.utmSource)}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Referrer</dt>
                      <dd className="mobile-card__value">{textOrDash(item.referrer)}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Payload</dt>
                      <dd className="mobile-card__value">
                        <code className="activity-payload">{formatPayload(item.payload)}</code>
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="pager pager--compact">
              <button
                className="pager-button pager-button--nav"
                type="button"
                disabled={!canGoGuestPrev}
                onClick={() => setGuestPage((current) => Math.max(1, current - 1))}
              >
                ←
              </button>
              <span className="pager-mobile-status">
                Стр. {guestPage} из {guestTotalPages}
              </span>
              <button
                className="pager-button pager-button--nav"
                type="button"
                disabled={!canGoGuestNext}
                onClick={() => setGuestPage((current) => Math.min(guestTotalPages, current + 1))}
              >
                →
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
