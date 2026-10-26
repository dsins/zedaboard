import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..");
export const DATA_DIR = join(ROOT, "data");
export const DB_PATH = join(DATA_DIR, "board.db");

mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

export const db = new Database(DB_PATH, { create: true });

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ip         TEXT,
    ua         TEXT
  );

  CREATE TABLE IF NOT EXISTS attempts (
    ip           TEXT PRIMARY KEY,
    failures     INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL,
    banned_until INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    ts   INTEGER NOT NULL,
    ip   TEXT,
    kind TEXT NOT NULL,
    detail TEXT
  );
`);

export function getSetting(key: string): string | null {
  const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.query(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function logEvent(ip: string, kind: string, detail = ""): void {
  db.query("INSERT INTO events(ts, ip, kind, detail) VALUES(?, ?, ?, ?)").run(
    Date.now(),
    ip,
    kind,
    detail,
  );
}
