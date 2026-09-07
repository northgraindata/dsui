import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0002_local_sessions: Migration = {
  version: 2,
  name: "local-sessions",
  up(db: Database): void {
    db.exec(`CREATE TABLE IF NOT EXISTS local_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES local_users(id) ON DELETE CASCADE
    );`);
  },
};
