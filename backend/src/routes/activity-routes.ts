import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import {
  ACTIVITY_EVENT_TYPES,
  createActivityEvent,
  searchActivityEvents,
} from "../repositories/activity-event-repository";
import { normalizeLogin } from "../services/auth-service";

const ACTIVITY_EVENT_MAX_PAYLOAD_BYTES = 4096;
const ACTIVITY_RATE_LIMIT_WINDOW_MS = 60_000;
const ACTIVITY_RATE_LIMIT_MAX_EVENTS = 120;

const activityRateLimitByUser = new Map<number, number[]>();

const createActivityEventBodySchema = z.object({
  eventType: z.enum(ACTIVITY_EVENT_TYPES),
  sessionId: z.string().trim().min(8).max(120),
  page: z.string().trim().min(1).max(240).optional(),
  entityType: z.string().trim().min(1).max(120).optional(),
  entityId: z.string().trim().min(1).max(120).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const searchActivityEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.coerce.number().int().positive().optional(),
  login: z.string().trim().min(1).max(120).optional(),
  eventType: z.enum(ACTIVITY_EVENT_TYPES).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
});

function rejectIfNotAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (request.authUser?.role === "admin") {
    return false;
  }

  void reply.code(403).send({ message: "Forbidden" });
  return true;
}

function normalizeDateInput(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid datetime");
  }

  return parsed.toISOString();
}

function isUserRateLimited(userId: number, nowMs: number): boolean {
  const bucket = activityRateLimitByUser.get(userId) ?? [];
  const threshold = nowMs - ACTIVITY_RATE_LIMIT_WINDOW_MS;
  const fresh = bucket.filter((item) => item >= threshold);

  if (fresh.length >= ACTIVITY_RATE_LIMIT_MAX_EVENTS) {
    activityRateLimitByUser.set(userId, fresh);
    return true;
  }

  fresh.push(nowMs);
  activityRateLimitByUser.set(userId, fresh);
  return false;
}

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/activity/events", async (request, reply) => {
    if (!request.authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    try {
      const payload = createActivityEventBodySchema.parse(request.body);
      const payloadJson = payload.payload ? JSON.stringify(payload.payload) : null;

      if (
        payloadJson &&
        Buffer.byteLength(payloadJson, "utf8") > ACTIVITY_EVENT_MAX_PAYLOAD_BYTES
      ) {
        return reply.code(400).send({ message: "Payload too large" });
      }

      const nowMs = Date.now();
      if (isUserRateLimited(request.authUser.id, nowMs)) {
        return reply.code(429).send({ message: "Too many activity events" });
      }

      createActivityEvent({
        user_id: request.authUser.id,
        login: request.authUser.login,
        session_id: payload.sessionId,
        event_type: payload.eventType,
        page: payload.page ?? null,
        entity_type: payload.entityType ?? null,
        entity_id: payload.entityId ?? null,
        payload_json: payloadJson,
      });

      return reply.code(201).send({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid request",
          errors: error.flatten(),
        });
      }

      request.log.error({ error }, "activity_event_create_failed");
      return reply.code(500).send({ message: "Failed to save activity event" });
    }
  });

  app.get("/api/admin/activity", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    try {
      const query = searchActivityEventsQuerySchema.parse(request.query);
      const normalizedFrom = normalizeDateInput(query.from);
      const normalizedTo = normalizeDateInput(query.to);

      const result = searchActivityEvents({
        page: query.page,
        pageSize: query.pageSize,
        userId: query.userId,
        login: query.login ? normalizeLogin(query.login) : undefined,
        eventType: query.eventType,
        from: normalizedFrom,
        to: normalizedTo,
      });

      return reply.code(200).send({
        items: result.items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid query",
          errors: error.flatten(),
        });
      }

      if (error instanceof Error && error.message === "Invalid datetime") {
        return reply.code(400).send({ message: "Invalid datetime filter" });
      }

      request.log.error({ error }, "activity_events_search_failed");
      return reply.code(500).send({ message: "Failed to fetch activity events" });
    }
  });
}
