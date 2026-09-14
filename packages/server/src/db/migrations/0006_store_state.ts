import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0006_store_state: Migration = {
  version: 6,
  name: "store_state",
  up(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS store_state (
        namespace TEXT NOT NULL,
        scope TEXT NOT NULL,
        store_id TEXT NOT NULL,
        store_key TEXT NOT NULL,
        version INTEGER NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (namespace, scope, store_id, store_key)
      );
    `);
  },
};
