import { db } from "../db/connection";
import { mapPublicAuthUser, type PublicAuthUser } from "./auth-user-repository";

interface CreateSessionInput {
  user_id: number;
  token_hash: string;
  expires_at: string;
}

interface SessionUserRow {
  session_id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  id: number;
  login: string;
  display_name: string;
  role: string;
  is_active: number;
}

export interface SessionUser {
  sessionId: number;
  tokenHash: string;
  expiresAt: string;
  user: PublicAuthUser;
}

export function createSession(input: CreateSessionInput): void {
  db.prepare(
    `
      INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      VALUES (@user_id, @token_hash, @expires_at)
    `,
  ).run(input);
}

export function findSessionUserByTokenHash(tokenHash: string): SessionUser | null {
  const row = db
    .prepare(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
          s.token_hash,
          s.expires_at,
          u.id,
          u.login,
          u.display_name,
          u.role,
          u.is_active
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
      `,
    )
    .get(tokenHash) as SessionUserRow | undefined;

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    user: mapPublicAuthUser(row),
  };
}

export function deleteSessionByTokenHash(tokenHash: string): void {
  db.prepare(
    `
      DELETE FROM auth_sessions
      WHERE token_hash = ?
    `,
  ).run(tokenHash);
}

export function touchSession(sessionId: number): void {
  db.prepare(
    `
      UPDATE auth_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(sessionId);
}

export function deleteExpiredSessions(nowIso: string): void {
  db.prepare(
    `
      DELETE FROM auth_sessions
      WHERE datetime(expires_at) <= datetime(?)
    `,
  ).run(nowIso);
}
