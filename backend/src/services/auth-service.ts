import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import {
  createSession,
  deleteExpiredSessions,
  deleteSessionByTokenHash,
  findSessionUserByTokenHash,
  touchSession,
} from "../repositories/auth-session-repository";
import {
  findUserByLogin,
  mapPublicAuthUser,
  upsertUserByLogin,
  type PublicAuthUser,
} from "../repositories/auth-user-repository";

const PASSWORD_HASH_PREFIX = "scrypt";
const PASSWORD_HASH_KEY_LENGTH = 64;
const SESSION_COOKIE_NAME = "lease_platform_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface AuthLoginResult {
  user: PublicAuthUser;
  sessionToken: string;
  sessionMaxAgeSeconds: number;
}

function toScryptHash(password: string, saltHex: string): Buffer {
  return scryptSync(password, Buffer.from(saltHex, "hex"), PASSWORD_HASH_KEY_LENGTH);
}

function createPasswordHash(password: string): string {
  const saltHex = randomBytes(16).toString("hex");
  const hashHex = toScryptHash(password, saltHex).toString("hex");
  return `${PASSWORD_HASH_PREFIX}:${saltHex}:${hashHex}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [prefix, saltHex, hashHex] = parts;
  if (prefix !== PASSWORD_HASH_PREFIX || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const actual = toScryptHash(password, saltHex);
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeLogin(rawLogin: string): string {
  return rawLogin.trim().toLowerCase();
}

export function buildPasswordHash(password: string): string {
  const normalized = password.trim();
  if (normalized.length < 4) {
    throw new Error("Password must be at least 4 characters long");
  }
  return createPasswordHash(normalized);
}

export function ensureBaseAdminCredentials(): void {
  upsertUserByLogin({
    login: "admin",
    password_hash: createPasswordHash("admin"),
    display_name: "Администратор",
  });
}

export function loginWithPassword(login: string, password: string): AuthLoginResult | null {
  const normalizedLogin = normalizeLogin(login);
  const user = findUserByLogin(normalizedLogin);

  if (!user || user.is_active !== 1) {
    return null;
  }

  if (!verifyPassword(password, user.password_hash)) {
    return null;
  }

  const now = new Date();
  deleteExpiredSessions(now.toISOString());

  const sessionToken = createSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();

  createSession({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return {
    user: mapPublicAuthUser(user),
    sessionToken,
    sessionMaxAgeSeconds: SESSION_TTL_SECONDS,
  };
}

export function authenticateRequest(
  request: FastifyRequest,
): PublicAuthUser | null {
  const sessionToken = request.cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = findSessionUserByTokenHash(tokenHash);
  if (!session) {
    return null;
  }

  const nowIso = new Date().toISOString();
  if (session.expiresAt <= nowIso) {
    deleteSessionByTokenHash(tokenHash);
    return null;
  }

  touchSession(session.sessionId);
  return session.user;
}

export function logoutRequest(request: FastifyRequest): void {
  const sessionToken = request.cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    return;
  }

  const tokenHash = hashSessionToken(sessionToken);
  deleteSessionByTokenHash(tokenHash);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
