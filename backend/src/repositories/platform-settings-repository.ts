import { db } from "../db/connection";

export type PlatformMode = "closed" | "open";

const PLATFORM_MODE_KEY = "platform_mode";

function normalizePlatformMode(rawValue: string | undefined): PlatformMode {
  return rawValue === "open" ? "open" : "closed";
}

export function getPlatformMode(): PlatformMode {
  const row = db
    .prepare(
      `
        SELECT value
        FROM platform_settings
        WHERE key = ?
        LIMIT 1
      `,
    )
    .get(PLATFORM_MODE_KEY) as { value: string } | undefined;

  return normalizePlatformMode(row?.value);
}

export function setPlatformMode(mode: PlatformMode): PlatformMode {
  const normalizedMode = normalizePlatformMode(mode);

  db.prepare(
    `
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES (@key, @value, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run({
    key: PLATFORM_MODE_KEY,
    value: normalizedMode,
  });

  return normalizedMode;
}

