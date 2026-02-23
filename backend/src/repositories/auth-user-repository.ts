import { db } from "../db/connection";

export interface AuthUserRecord {
  id: number;
  login: string;
  password_hash: string;
  display_name: string;
  is_active: number;
  created_at: string;
}

export interface PublicAuthUser {
  id: number;
  login: string;
  displayName: string;
}

interface CreateUserInput {
  login: string;
  password_hash: string;
  display_name: string;
}

interface UpsertUserInput {
  login: string;
  password_hash: string;
  display_name: string;
}

export function mapPublicAuthUser(record: {
  id: number;
  login: string;
  display_name: string;
}): PublicAuthUser {
  return {
    id: record.id,
    login: record.login,
    displayName: record.display_name,
  };
}

export function findUserByLogin(login: string): AuthUserRecord | null {
  const row = db
    .prepare(
      `
        SELECT id, login, password_hash, display_name, is_active, created_at
        FROM users
        WHERE login = ?
      `,
    )
    .get(login) as AuthUserRecord | undefined;

  return row ?? null;
}

export function findUserById(id: number): AuthUserRecord | null {
  const row = db
    .prepare(
      `
        SELECT id, login, password_hash, display_name, is_active, created_at
        FROM users
        WHERE id = ?
      `,
    )
    .get(id) as AuthUserRecord | undefined;

  return row ?? null;
}

export function createUser(input: CreateUserInput): PublicAuthUser {
  const result = db
    .prepare(
      `
        INSERT INTO users (login, password_hash, display_name, is_active)
        VALUES (@login, @password_hash, @display_name, 1)
      `,
    )
    .run(input);

  const created = findUserById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("Failed to create user");
  }

  return mapPublicAuthUser(created);
}

export function upsertUserByLogin(input: UpsertUserInput): PublicAuthUser {
  db.prepare(
    `
      INSERT INTO users (login, password_hash, display_name, is_active)
      VALUES (@login, @password_hash, @display_name, 1)
      ON CONFLICT(login) DO UPDATE SET
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        is_active = 1
    `,
  ).run(input);

  const user = findUserByLogin(input.login);
  if (!user) {
    throw new Error("Failed to upsert user");
  }

  return mapPublicAuthUser(user);
}

export function updateUserPasswordByLogin(
  login: string,
  passwordHash: string,
): boolean {
  const result = db
    .prepare(
      `
        UPDATE users
        SET password_hash = ?, is_active = 1
        WHERE login = ?
      `,
    )
    .run(passwordHash, login);

  return result.changes > 0;
}
