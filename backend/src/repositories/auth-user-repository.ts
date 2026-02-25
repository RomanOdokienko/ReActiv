import { db } from "../db/connection";

export type UserRole = "admin" | "manager" | "stock_owner";

export interface AuthUserRecord {
  id: number;
  login: string;
  password_hash: string;
  display_name: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  role: UserRole;
  is_active: number;
  created_at: string;
}

export interface PublicAuthUser {
  id: number;
  login: string;
  displayName: string;
  role: UserRole;
}

export interface AdminUserListItem {
  id: number;
  login: string;
  displayName: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

interface CreateUserInput {
  login: string;
  password_hash: string;
  display_name: string;
  company?: string | null;
  phone?: string | null;
  notes?: string | null;
  role?: UserRole;
}

interface UpsertUserInput {
  login: string;
  password_hash: string;
  display_name: string;
  role?: UserRole;
}

function normalizeRole(role: string | null | undefined): UserRole {
  if (role === "admin") {
    return "admin";
  }
  if (role === "stock_owner") {
    return "stock_owner";
  }
  return "manager";
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function mapPublicAuthUser(record: {
  id: number;
  login: string;
  display_name: string;
  role: string;
}): PublicAuthUser {
  return {
    id: record.id,
    login: record.login,
    displayName: record.display_name,
    role: normalizeRole(record.role),
  };
}

function mapAdminUserListItem(record: {
  id: number;
  login: string;
  display_name: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  role: string;
  is_active: number;
  created_at: string;
}): AdminUserListItem {
  return {
    id: record.id,
    login: record.login,
    displayName: record.display_name,
    company: record.company,
    phone: record.phone,
    notes: record.notes,
    role: normalizeRole(record.role),
    isActive: record.is_active === 1,
    createdAt: record.created_at,
  };
}

export function findUserByLogin(login: string): AuthUserRecord | null {
  const row = db
    .prepare(
      `
        SELECT id, login, password_hash, display_name, company, phone, notes, role, is_active, created_at
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
        SELECT id, login, password_hash, display_name, company, phone, notes, role, is_active, created_at
        FROM users
        WHERE id = ?
      `,
    )
    .get(id) as AuthUserRecord | undefined;

  return row ?? null;
}

export function createUser(input: CreateUserInput): PublicAuthUser {
  const payload = {
    ...input,
    company: normalizeOptionalText(input.company),
    phone: normalizeOptionalText(input.phone),
    notes: normalizeOptionalText(input.notes),
    role: input.role ?? "manager",
  };

  const result = db
    .prepare(
      `
        INSERT INTO users (login, password_hash, display_name, company, phone, notes, role, is_active)
        VALUES (@login, @password_hash, @display_name, @company, @phone, @notes, @role, 1)
      `,
    )
    .run(payload);

  const created = findUserById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("Failed to create user");
  }

  return mapPublicAuthUser(created);
}

export function upsertUserByLogin(input: UpsertUserInput): PublicAuthUser {
  const payload = {
    ...input,
    role: input.role ?? "manager",
  };

  db.prepare(
    `
      INSERT INTO users (login, password_hash, display_name, role, is_active)
      VALUES (@login, @password_hash, @display_name, @role, 1)
      ON CONFLICT(login) DO UPDATE SET
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        role = excluded.role,
        is_active = 1
    `,
  ).run(payload);

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

export function updateUserPasswordById(
  userId: number,
  passwordHash: string,
): boolean {
  const result = db
    .prepare(
      `
        UPDATE users
        SET password_hash = ?, is_active = 1
        WHERE id = ?
      `,
    )
    .run(passwordHash, userId);

  if (result.changes === 0) {
    return false;
  }

  db.prepare(
    `
      DELETE FROM auth_sessions
      WHERE user_id = ?
    `,
  ).run(userId);

  return true;
}

export function listUsersForAdmin(): AdminUserListItem[] {
  const rows = db
    .prepare(
      `
        SELECT id, login, display_name, company, phone, notes, role, is_active, created_at
        FROM users
        ORDER BY created_at DESC
      `,
    )
    .all() as Array<{
    id: number;
    login: string;
    display_name: string;
    company: string | null;
    phone: string | null;
    notes: string | null;
    role: string;
    is_active: number;
    created_at: string;
  }>;

  return rows.map(mapAdminUserListItem);
}

export function deleteUserById(id: number): boolean {
  db.prepare(
    `
      DELETE FROM auth_sessions
      WHERE user_id = ?
    `,
  ).run(id);

  const result = db
    .prepare(
      `
        DELETE FROM users
        WHERE id = ?
      `,
    )
    .run(id);

  return result.changes > 0;
}

interface UpdateUserMetaInput {
  company?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export function updateUserMetaById(userId: number, input: UpdateUserMetaInput): void {
  db.prepare(
    `
      UPDATE users
      SET
        company = @company,
        phone = @phone,
        notes = @notes
      WHERE id = @id
    `,
  ).run({
    id: userId,
    company: normalizeOptionalText(input.company),
    phone: normalizeOptionalText(input.phone),
    notes: normalizeOptionalText(input.notes),
  });
}

export function countUsersByRole(role: UserRole): number {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM users
        WHERE role = ?
      `,
    )
    .get(role) as { total: number };

  return row.total;
}
