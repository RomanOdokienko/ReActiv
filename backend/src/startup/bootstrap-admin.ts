import type { FastifyBaseLogger } from "fastify";
import { findUserByLogin, upsertUserByLogin } from "../repositories/auth-user-repository";
import { buildPasswordHash, normalizeLogin } from "../services/auth-service";

const LOGIN_ENV = "BOOTSTRAP_ADMIN_LOGIN";
const PASSWORD_ENV = "BOOTSTRAP_ADMIN_PASSWORD";
const DISPLAY_NAME_ENV = "BOOTSTRAP_ADMIN_DISPLAY_NAME";

export function ensureBootstrapAdmin(logger: FastifyBaseLogger): void {
  const rawLogin = process.env[LOGIN_ENV]?.trim();
  const rawPassword = process.env[PASSWORD_ENV]?.trim();
  const rawDisplayName = process.env[DISPLAY_NAME_ENV]?.trim();

  if (!rawLogin || !rawPassword) {
    return;
  }

  const login = normalizeLogin(rawLogin);
  const existing = findUserByLogin(login);
  if (existing) {
    logger.info({ login }, "bootstrap_admin_exists_skip");
    return;
  }

  const displayName = rawDisplayName || login;
  try {
    upsertUserByLogin({
      login,
      password_hash: buildPasswordHash(rawPassword),
      display_name: displayName,
      role: "admin",
    });

    logger.warn(
      { login },
      "bootstrap_admin_created_from_env",
    );
  } catch (error) {
    logger.error(
      { error, login },
      "bootstrap_admin_creation_failed",
    );
  }
}
