import type { Database } from "bun:sqlite";

/** One numbered schema migration. Versions are dense, starting at 1. */
export interface Migration {
  readonly version: number;
  /** Short slug for logs, e.g. "init". */
  readonly name: string;
  /** Applies the migration. Must be idempotent-safe inside a transaction. */
  up(db: Database): void;
}

export const migration_0001_init: Migration = {
  version: 1,
  name: "init",
  up(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ui_services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, adapter TEXT NOT NULL,
      connection_ciphertext TEXT NOT NULL, connection_iv TEXT NOT NULL, connection_tag TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL,
      action TEXT NOT NULL, target TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL, created_at TEXT NOT NULL
    );`);
  },
};
