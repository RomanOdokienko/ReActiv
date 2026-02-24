import { useEffect, useMemo, useState } from "react";
import { getAdminActivity } from "../api/client";
import type { ActivityEventItem, ActivityEventType } from "../types/api";

const EVENT_TYPE_OPTIONS: Array<{ value: "" | ActivityEventType; label: string }> = [
  { value: "", label: "Все события" },
  { value: "login_success", label: "Вход" },
  { value: "logout", label: "Выход" },
  { value: "session_start", label: "Старт сессии" },
  { value: "session_heartbeat", label: "Heartbeat" },
  { value: "showcase_open", label: "Открытие витрины" },
  { value: "showcase_filters_apply", label: "Применение фильтров" },
  { value: "showcase_page_change", label: "Смена страницы витрины" },
  { value: "showcase_item_open", label: "Открытие карточки витрины" },
];

interface AppliedFilters {
  login: string;
  userId: string;
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

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    login: "",
    userId: "",
    eventType: "",
    from: "",
    to: "",
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

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

  return (
    <section>
      <h1>Активность пользователей</h1>

      <div className="panel">
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
              <option key={item.label} value={item.value}>
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
                    <tr key={item.id}>
                      <td>{item.createdAt}</td>
                      <td>
                        {item.login} (#{item.userId})
                      </td>
                      <td>{eventTypeLabel(item.eventType)}</td>
                      <td>{item.page || "-"}</td>
                      <td>
                        {item.entityType
                          ? `${item.entityType}${item.entityId ? `:${item.entityId}` : ""}`
                          : "-"}
                      </td>
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
                <article key={`mobile-${item.id}`} className="mobile-card">
                  <div className="mobile-card__head">
                    <strong>{eventTypeLabel(item.eventType)}</strong>
                    <span className="mobile-card__meta">{item.createdAt}</span>
                  </div>
                  <dl className="mobile-card__list">
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Пользователь</dt>
                      <dd className="mobile-card__value">
                        {item.login} (#{item.userId})
                      </dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Страница</dt>
                      <dd className="mobile-card__value">{item.page || "-"}</dd>
                    </div>
                    <div className="mobile-card__row">
                      <dt className="mobile-card__label">Сущность</dt>
                      <dd className="mobile-card__value">
                        {item.entityType
                          ? `${item.entityType}${item.entityId ? `:${item.entityId}` : ""}`
                          : "-"}
                      </dd>
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
    </section>
  );
}
