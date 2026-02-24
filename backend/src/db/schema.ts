import { db } from "./connection";

export function initializeSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      status TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      imported_rows INTEGER NOT NULL DEFAULT 0,
      skipped_rows INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS import_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_batch_id TEXT NOT NULL,
      row_number INTEGER NOT NULL,
      field TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
    );

    CREATE TABLE IF NOT EXISTS vehicle_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_batch_id TEXT NOT NULL,
      offer_code TEXT NOT NULL,
      status TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      modification TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      mileage_km INTEGER NOT NULL,
      key_count INTEGER NOT NULL,
      pts_type TEXT NOT NULL,
      has_encumbrance INTEGER NOT NULL,
      is_deregistered INTEGER NOT NULL,
      responsible_person TEXT NOT NULL,
      storage_address TEXT NOT NULL,
      days_on_sale INTEGER NOT NULL,
      price REAL NOT NULL,
      yandex_disk_url TEXT NOT NULL,
      booking_status TEXT NOT NULL,
      external_id TEXT NOT NULL,
      crm_ref TEXT NOT NULL,
      website_url TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'manager',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_offer_code ON vehicle_offers(offer_code);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_status ON vehicle_offers(status);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_brand ON vehicle_offers(brand);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_model ON vehicle_offers(model);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_modification ON vehicle_offers(modification);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_vehicle_type ON vehicle_offers(vehicle_type);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_pts_type ON vehicle_offers(pts_type);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_has_encumbrance ON vehicle_offers(has_encumbrance);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_is_deregistered ON vehicle_offers(is_deregistered);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_responsible_person ON vehicle_offers(responsible_person);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_storage_address ON vehicle_offers(storage_address);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_booking_status ON vehicle_offers(booking_status);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_external_id ON vehicle_offers(external_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_crm_ref ON vehicle_offers(crm_ref);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_website_url ON vehicle_offers(website_url);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_yandex_disk_url ON vehicle_offers(yandex_disk_url);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_price ON vehicle_offers(price);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_year ON vehicle_offers(year);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_mileage_km ON vehicle_offers(mileage_km);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_key_count ON vehicle_offers(key_count);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_days_on_sale ON vehicle_offers(days_on_sale);
    CREATE INDEX IF NOT EXISTS idx_vehicle_offers_created_at ON vehicle_offers(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
  `);

  const userColumns = db
    .prepare(`PRAGMA table_info(users)`)
    .all() as Array<{ name: string }>;
  const hasRoleColumn = userColumns.some((column) => column.name === "role");
  if (!hasRoleColumn) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'manager';`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);

  db.prepare(
    `
      UPDATE users
      SET role = 'admin'
      WHERE lower(login) = 'admin'
    `,
  ).run();

  const adminCountRow = db
    .prepare(`SELECT COUNT(*) AS total FROM users WHERE role = 'admin'`)
    .get() as { total: number };
  if (adminCountRow.total === 0) {
    db.prepare(
      `
        UPDATE users
        SET role = 'admin'
        WHERE id = (
          SELECT id
          FROM users
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        )
      `,
    ).run();
  }
}
