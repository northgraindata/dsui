import type { Migration } from "../migrate";

export const migration_0015_connectors: Migration = {
  version: 15,
  name: "connectors",
  up(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      revoked_at TEXT,
      last_connected_at TEXT,
      last_seen_at TEXT,
      info TEXT NOT NULL DEFAULT '{}'
    );`);
  },
};
