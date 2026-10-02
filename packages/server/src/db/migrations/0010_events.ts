import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

/** Durable signal log shared by adapter jobs and the rest of DSUI. */
export const migration_0010_events: Migration = {
  version: 10,
  name: "events",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        signal_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        service_id TEXT,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT,
        occurred_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_recent
        ON events (occurred_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS events_service_recent
        ON events (service_id, occurred_at DESC, id DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS events_idempotency
        ON events (source_type, source_id, signal_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);
  },
};
