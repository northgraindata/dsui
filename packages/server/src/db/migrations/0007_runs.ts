import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0007_runs: Migration = {
  version: 7,
  name: "runs",
  up(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        invocation_id TEXT PRIMARY KEY,
        provider_run_id TEXT,
        request_json TEXT NOT NULL,
        state TEXT NOT NULL,
        provider_status_json TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        duration_ms INTEGER,
        trigger TEXT,
        environment TEXT,
        cancellable INTEGER NOT NULL,
        retryable INTEGER NOT NULL,
        retried_from_invocation_id TEXT,
        FOREIGN KEY (retried_from_invocation_id) REFERENCES runs(invocation_id)
      );
      CREATE INDEX IF NOT EXISTS runs_state_idx ON runs(state);
      CREATE TABLE IF NOT EXISTS run_idempotency (
        idempotency_key TEXT PRIMARY KEY,
        request_fingerprint TEXT NOT NULL,
        invocation_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        FOREIGN KEY (invocation_id) REFERENCES runs(invocation_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS run_idempotency_fingerprint_idx
        ON run_idempotency(request_fingerprint);
      CREATE TABLE IF NOT EXISTS run_events (
        invocation_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        event_json TEXT NOT NULL,
        at TEXT NOT NULL,
        type TEXT NOT NULL,
        PRIMARY KEY (invocation_id, sequence),
        FOREIGN KEY (invocation_id) REFERENCES runs(invocation_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS run_events_cursor_idx
        ON run_events(invocation_id, sequence);
      CREATE TABLE IF NOT EXISTS run_artifacts (
        invocation_id TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        artifact_json TEXT NOT NULL,
        kind TEXT NOT NULL,
        content_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (invocation_id, artifact_id),
        FOREIGN KEY (invocation_id) REFERENCES runs(invocation_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS run_artifacts_kind_idx
        ON run_artifacts(invocation_id, kind);
    `);
  },
};
