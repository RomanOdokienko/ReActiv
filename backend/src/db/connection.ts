import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  const dataDir = path.resolve(__dirname, "../../data");
  return path.join(dataDir, "lease-platform.db");
}

const dbPath = resolveDbPath();
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
