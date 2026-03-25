import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  getCsrfTokenForRequest,
  getSessionCookieName,
  issueCsrfToken,
  loginWithPassword,
  logoutRequest,
} from "../services/auth-service";

const loginBodySchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

const AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = parsePositiveIntEnv(
  "AUTH_LOGIN_RATE_LIMIT_WINDOW_MS",
  60_000,
  5_000,
  15 * 60_000,
);
const AUTH_LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS = parsePositiveIntEnv(
  "AUTH_LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS",
  40,
  5,
  1_000,
);
const AUTH_LOGIN_RATE_LIMIT_MAX_IP_LOGIN_ATTEMPTS = parsePositiveIntEnv(
  "AUTH_LOGIN_RATE_LIMIT_MAX_IP_LOGIN_ATTEMPTS",
  12,
  3,
  500,
);

const loginFailedAttemptsByIp = new Map<string, number[]>();
const loginFailedAttemptsByIpLogin = new Map<string, number[]>();

function parsePositiveIntEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  if (normalized < min) {
    return fallback;
  }

  return Math.min(normalized, max);
}

function getRateLimitBucket(
  buckets: Map<string, number[]>,
  key: string,
  nowMs: number,
): number[] {
  const existing = buckets.get(key) ?? [];
  const threshold = nowMs - AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
  const fresh = existing.filter((timestamp) => timestamp >= threshold);
  buckets.set(key, fresh);
  return fresh;
}

function isLoginRateLimited(
  buckets: Map<string, number[]>,
  key: string,
  limit: number,
  nowMs: number,
): boolean {
  const fresh = getRateLimitBucket(buckets, key, nowMs);
  return fresh.length >= limit;
}

function recordLoginFailureAttempt(
  buckets: Map<string, number[]>,
  key: string,
  nowMs: number,
): void {
  const fresh = getRateLimitBucket(buckets, key, nowMs);
  fresh.push(nowMs);
  buckets.set(key, fresh);
}

function normalizeLoginValue(value: string): string {
  return value.trim().toLowerCase();
}

function resolveClientIp(request: { ip?: string }): string {
  const value = request.ip?.trim();
  return value || "unknown";
}

function applyNoStoreHeaders(reply: {
  header: (name: string, value: string) => unknown;
}): void {
  reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
  reply.header("Pragma", "no-cache");
  reply.header("Expires", "0");
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/login", async (request, reply) => {
    applyNoStoreHeaders(reply);

    try {
      const payload = loginBodySchema.parse(request.body);
      const nowMs = Date.now();
      const ipKey = resolveClientIp(request);
      const loginKey = normalizeLoginValue(payload.login);
      const ipLoginKey = `${ipKey}:${loginKey}`;

      if (
        isLoginRateLimited(
          loginFailedAttemptsByIp,
          ipKey,
          AUTH_LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS,
          nowMs,
        ) ||
        isLoginRateLimited(
          loginFailedAttemptsByIpLogin,
          ipLoginKey,
          AUTH_LOGIN_RATE_LIMIT_MAX_IP_LOGIN_ATTEMPTS,
          nowMs,
        )
      ) {
        return reply.code(429).send({ message: "Too many login attempts. Try again later." });
      }

      const loginResult = loginWithPassword(payload.login, payload.password);

      if (!loginResult) {
        recordLoginFailureAttempt(loginFailedAttemptsByIp, ipKey, nowMs);
        recordLoginFailureAttempt(loginFailedAttemptsByIpLogin, ipLoginKey, nowMs);
        return reply.code(401).send({ message: "Неверный логин или пароль" });
      }

      loginFailedAttemptsByIpLogin.delete(ipLoginKey);

      reply.setCookie(getSessionCookieName(), loginResult.sessionToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: loginResult.sessionMaxAgeSeconds,
      });

      return reply.code(200).send({
        user: loginResult.user,
        csrfToken: issueCsrfToken(loginResult.sessionToken),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Некорректный запрос",
          errors: error.flatten(),
        });
      }

      return reply.code(500).send({ message: "Ошибка авторизации" });
    }
  });

  app.get("/api/auth/me", async (request, reply) => {
    applyNoStoreHeaders(reply);

    if (!request.authUser) {
      return reply.code(401).send({ message: "Требуется авторизация" });
    }

    const csrfToken = getCsrfTokenForRequest(request);
    if (!csrfToken) {
      return reply.code(401).send({ message: "Требуется авторизация" });
    }

    return reply.code(200).send({
      user: request.authUser,
      csrfToken,
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    applyNoStoreHeaders(reply);

    logoutRequest(request);

    reply.clearCookie(getSessionCookieName(), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return reply.code(200).send({ message: "Выход выполнен" });
  });
}
