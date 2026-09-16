import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0008_run_cancellation_idempotency: Migration = {
  version: 8,
  name: "run cancellation idempotency",
  up(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS run_cancellation_idempotency (
        invocation_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (invocation_id, idempotency_key),
        FOREIGN KEY (invocation_id) REFERENCES runs(invocation_id) ON DELETE CASCADE
      );
    `);
  },
};
