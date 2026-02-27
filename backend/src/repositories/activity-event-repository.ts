import { db } from "../db/connection";

export const ACTIVITY_EVENT_TYPES = [
  "login_open",
  "login_success",
  "login_failed",
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

export interface CreateGuestActivityEventInput {
  session_id: string;
  event_type: ActivityEventType;
  page: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload_json: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
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

interface GuestActivityEventRow {
  id: number;
  session_id: string;
  event_type: ActivityEventType;
  page: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload_json: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
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

export interface GuestActivityEventListItem {
  id: number;
  sessionId: string;
  eventType: ActivityEventType;
  page: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referrer: string | null;
  userAgent: string | null;
  ipHash: string | null;
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

export interface GuestActivityEventSearchQuery {
  page: number;
  pageSize: number;
  sessionId?: string;
  eventType?: ActivityEventType;
  from?: string;
  to?: string;
}

export interface GuestActivityEventSearchResult {
  items: GuestActivityEventListItem[];
  total: number;
}

export interface GuestActivitySummaryQuery {
  from?: string;
  to?: string;
}

export interface GuestActivitySummarySourceItem {
  source: string;
  sessions: number;
  sharePercent: number;
}

export interface GuestActivitySummaryFilterFieldItem {
  field: string;
  count: number;
  sharePercent: number;
}

export interface GuestActivitySummaryResult {
  uniqueSessions: number;
  totalEvents: number;
  showcaseOpen: number;
  filtersApply: number;
  itemOpen: number;
  loginOpen: number;
  noResults: number;
  apiErrors: number;
  showcaseToItemCtrPercent: number;
  showcaseToLoginPercent: number;
  filtersToNoResultsPercent: number;
  totalSessionDurationSec: number;
  avgSessionDurationSec: number;
  medianSessionDurationSec: number;
  topSources: GuestActivitySummarySourceItem[];
  topFilterFields: GuestActivitySummaryFilterFieldItem[];
}

interface GuestSessionDurationRow {
  session_id: string;
  started_at_unix: number;
  ended_at_unix: number;
}

interface GuestSourceRow {
  session_id: string;
  utm_source: string | null;
  referrer: string | null;
  created_at: string;
}

interface GuestFilterPayloadRow {
  payload_json: string | null;
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

function mapGuestRowToListItem(row: GuestActivityEventRow): GuestActivityEventListItem {
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
    sessionId: row.session_id,
    eventType: row.event_type,
    page: row.page,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmTerm: row.utm_term,
    utmContent: row.utm_content,
    referrer: row.referrer,
    userAgent: row.user_agent,
    ipHash: row.ip_hash,
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

function buildGuestWhereClause(filters: GuestActivityEventSearchQuery): {
  whereClause: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.sessionId) {
    conditions.push("session_id = ?");
    params.push(filters.sessionId);
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

function buildGuestSummaryWhereClause(filters: GuestActivitySummaryQuery): {
  whereClause: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

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

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function sourceLabelFromReferrer(referrer: string | null): string | null {
  if (!referrer) {
    return null;
  }

  const trimmed = referrer.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.hostname || null;
  } catch {
    return trimmed.slice(0, 120);
  }
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

export function createGuestActivityEvent(input: CreateGuestActivityEventInput): void {
  db.prepare(
    `
      INSERT INTO guest_activity_events (
        session_id,
        event_type,
        page,
        entity_type,
        entity_id,
        payload_json,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        referrer,
        user_agent,
        ip_hash
      )
      VALUES (
        @session_id,
        @event_type,
        @page,
        @entity_type,
        @entity_id,
        @payload_json,
        @utm_source,
        @utm_medium,
        @utm_campaign,
        @utm_term,
        @utm_content,
        @referrer,
        @user_agent,
        @ip_hash
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

export function searchGuestActivityEvents(
  query: GuestActivityEventSearchQuery,
): GuestActivityEventSearchResult {
  const { whereClause, params } = buildGuestWhereClause(query);
  const offset = (query.page - 1) * query.pageSize;

  const totalRow = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM guest_activity_events
        ${whereClause}
      `,
    )
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `
        SELECT
          id,
          session_id,
          event_type,
          page,
          entity_type,
          entity_id,
          payload_json,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_term,
          utm_content,
          referrer,
          user_agent,
          ip_hash,
          created_at
        FROM guest_activity_events
        ${whereClause}
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...params, query.pageSize, offset) as GuestActivityEventRow[];

  return {
    items: rows.map(mapGuestRowToListItem),
    total: totalRow.total,
  };
}

export function getGuestActivitySummary(
  query: GuestActivitySummaryQuery,
): GuestActivitySummaryResult {
  const { whereClause, params } = buildGuestSummaryWhereClause(query);

  const counters = db
    .prepare(
      `
        SELECT
          COUNT(*) AS total_events,
          COUNT(DISTINCT session_id) AS unique_sessions,
          SUM(CASE WHEN event_type = 'showcase_open' THEN 1 ELSE 0 END) AS showcase_open,
          SUM(CASE WHEN event_type = 'showcase_filters_apply' THEN 1 ELSE 0 END) AS filters_apply,
          SUM(CASE WHEN event_type = 'showcase_item_open' THEN 1 ELSE 0 END) AS item_open,
          SUM(CASE WHEN event_type = 'login_open' THEN 1 ELSE 0 END) AS login_open,
          SUM(CASE WHEN event_type = 'showcase_no_results' THEN 1 ELSE 0 END) AS no_results,
          SUM(CASE WHEN event_type = 'api_error' THEN 1 ELSE 0 END) AS api_errors
        FROM guest_activity_events
        ${whereClause}
      `,
    )
    .get(...params) as {
    total_events: number | null;
    unique_sessions: number | null;
    showcase_open: number | null;
    filters_apply: number | null;
    item_open: number | null;
    login_open: number | null;
    no_results: number | null;
    api_errors: number | null;
  };

  const durations = db
    .prepare(
      `
        SELECT
          session_id,
          MIN(CAST(strftime('%s', created_at) AS INTEGER)) AS started_at_unix,
          MAX(CAST(strftime('%s', created_at) AS INTEGER)) AS ended_at_unix
        FROM guest_activity_events
        ${whereClause}
        GROUP BY session_id
      `,
    )
    .all(...params) as GuestSessionDurationRow[];

  const sessionDurations = durations.map((row) =>
    Math.max(0, row.ended_at_unix - row.started_at_unix),
  );
  const totalSessionDurationSec = sessionDurations.reduce((sum, value) => sum + value, 0);
  const avgSessionDurationSec = sessionDurations.length
    ? Math.round(totalSessionDurationSec / sessionDurations.length)
    : 0;
  const medianSessionDurationSec = median(sessionDurations);

  const sourceRows = db
    .prepare(
      `
        SELECT session_id, utm_source, referrer, created_at
        FROM guest_activity_events
        ${whereClause}
        ORDER BY session_id ASC, datetime(created_at) ASC, id ASC
      `,
    )
    .all(...params) as GuestSourceRow[];

  const sourceBySession = new Map<string, string>();
  for (const row of sourceRows) {
    if (sourceBySession.has(row.session_id)) {
      continue;
    }

    const utmSource = row.utm_source?.trim();
    if (utmSource) {
      sourceBySession.set(row.session_id, `utm:${utmSource}`);
      continue;
    }

    const referrerSource = sourceLabelFromReferrer(row.referrer);
    if (referrerSource) {
      sourceBySession.set(row.session_id, `ref:${referrerSource}`);
      continue;
    }

    sourceBySession.set(row.session_id, "direct");
  }

  const sourceCounts = new Map<string, number>();
  sourceBySession.forEach((source) => {
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  });

  const uniqueSessions = counters.unique_sessions ?? 0;
  const topSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, sessions]) => ({
      source,
      sessions,
      sharePercent: toPercent(sessions, uniqueSessions),
    }));

  const filterPayloadRows = db
    .prepare(
      `
        SELECT payload_json
        FROM guest_activity_events
        ${whereClause ? `${whereClause} AND event_type = 'showcase_filters_apply'` : "WHERE event_type = 'showcase_filters_apply'"}
      `,
    )
    .all(...params) as GuestFilterPayloadRow[];

  const filterFieldCounts = new Map<string, number>();
  let totalChangedFields = 0;
  filterPayloadRows.forEach((row) => {
    if (!row.payload_json) {
      return;
    }

    try {
      const parsed = JSON.parse(row.payload_json) as { changedFields?: unknown };
      if (!Array.isArray(parsed.changedFields)) {
        return;
      }

      parsed.changedFields.forEach((field) => {
        if (typeof field !== "string" || !field.trim()) {
          return;
        }

        const normalizedField = field.trim();
        filterFieldCounts.set(normalizedField, (filterFieldCounts.get(normalizedField) ?? 0) + 1);
        totalChangedFields += 1;
      });
    } catch {
      // ignore malformed payload
    }
  });

  const topFilterFields = Array.from(filterFieldCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([field, count]) => ({
      field,
      count,
      sharePercent: toPercent(count, totalChangedFields),
    }));

  const showcaseOpen = counters.showcase_open ?? 0;
  const filtersApply = counters.filters_apply ?? 0;
  const itemOpen = counters.item_open ?? 0;
  const loginOpen = counters.login_open ?? 0;
  const noResults = counters.no_results ?? 0;

  return {
    uniqueSessions,
    totalEvents: counters.total_events ?? 0,
    showcaseOpen,
    filtersApply,
    itemOpen,
    loginOpen,
    noResults,
    apiErrors: counters.api_errors ?? 0,
    showcaseToItemCtrPercent: toPercent(itemOpen, showcaseOpen),
    showcaseToLoginPercent: toPercent(loginOpen, showcaseOpen),
    filtersToNoResultsPercent: toPercent(noResults, filtersApply),
    totalSessionDurationSec,
    avgSessionDurationSec,
    medianSessionDurationSec,
    topSources,
    topFilterFields,
  };
}
