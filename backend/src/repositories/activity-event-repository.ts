import { db } from "../db/connection";

export const ACTIVITY_EVENT_TYPES = [
  "login_success",
  "logout",
  "session_start",
  "session_heartbeat",
  "page_view",
  "showcase_open",
  "showcase_filter_drawer_open",
  "showcase_filter_drawer_close",
  "showcase_filters_apply",
  "showcase_filters_reset",
  "showcase_no_results",
  "showcase_sort_change",
  "showcase_view_mode_change",
  "showcase_pagination_click",
  "showcase_page_change",
  "showcase_item_open",
  "showcase_gallery_open",
  "showcase_gallery_navigate",
  "showcase_gallery_close",
  "showcase_contact_click",
  "showcase_source_open",
  "api_error",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export interface CreateActivityEventInput {
  user_id: number;
  login: string;
  session_id: string;
  event_type: ActivityEventType;
  page: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload_json: string | null;
}

interface ActivityEventRow {
  id: number;
  user_id: number;
  login: string;
  session_id: string;
  event_type: ActivityEventType;
  page: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload_json: string | null;
  created_at: string;
}

export interface ActivityEventListItem {
  id: number;
  userId: number;
  login: string;
  sessionId: string;
  eventType: ActivityEventType;
  page: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityEventSearchQuery {
  page: number;
  pageSize: number;
  userId?: number;
  login?: string;
  eventType?: ActivityEventType;
  from?: string;
  to?: string;
}

export interface ActivityEventSearchResult {
  items: ActivityEventListItem[];
  total: number;
}

function mapRowToListItem(row: ActivityEventRow): ActivityEventListItem {
  let payload: Record<string, unknown> | null = null;
  if (row.payload_json) {
    try {
      const parsed = JSON.parse(row.payload_json) as Record<string, unknown>;
      payload = parsed;
    } catch {
      payload = null;
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    login: row.login,
    sessionId: row.session_id,
    eventType: row.event_type,
    page: row.page,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload,
    createdAt: row.created_at,
  };
}

function buildWhereClause(filters: ActivityEventSearchQuery): {
  whereClause: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.userId) {
    conditions.push("user_id = ?");
    params.push(filters.userId);
  }

  if (filters.login) {
    conditions.push("login = ?");
    params.push(filters.login);
  }

  if (filters.eventType) {
    conditions.push("event_type = ?");
    params.push(filters.eventType);
  }

  if (filters.from) {
    conditions.push("datetime(created_at) >= datetime(?)");
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push("datetime(created_at) <= datetime(?)");
    params.push(filters.to);
  }

  if (conditions.length === 0) {
    return { whereClause: "", params };
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

export function createActivityEvent(input: CreateActivityEventInput): void {
  db.prepare(
    `
      INSERT INTO user_activity_events (
        user_id,
        login,
        session_id,
        event_type,
        page,
        entity_type,
        entity_id,
        payload_json
      )
      VALUES (
        @user_id,
        @login,
        @session_id,
        @event_type,
        @page,
        @entity_type,
        @entity_id,
        @payload_json
      )
    `,
  ).run(input);
}

export function searchActivityEvents(
  query: ActivityEventSearchQuery,
): ActivityEventSearchResult {
  const { whereClause, params } = buildWhereClause(query);
  const offset = (query.page - 1) * query.pageSize;

  const totalRow = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM user_activity_events
        ${whereClause}
      `,
    )
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `
        SELECT
          id,
          user_id,
          login,
          session_id,
          event_type,
          page,
          entity_type,
          entity_id,
          payload_json,
          created_at
        FROM user_activity_events
        ${whereClause}
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...params, query.pageSize, offset) as ActivityEventRow[];

  return {
    items: rows.map(mapRowToListItem),
    total: totalRow.total,
  };
}
