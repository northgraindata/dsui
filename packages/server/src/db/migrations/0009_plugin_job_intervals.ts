import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

/** Repairs the durable queue schema and adds sub-minute job intervals. */
export const migration_0009_plugin_job_intervals: Migration = {
  version: 9,
  name: "plugin-job-intervals",
  up(db: Database): void {
    // A database may already have recorded version 8 from an earlier build
    // whose queue tables were absent. Keep this migration self-healing instead
    // of trusting the version marker as proof that every table exists.
    db.exec(`
      CREATE TABLE IF NOT EXISTS plugin_job_definitions (
        job_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        schedule_expr TEXT,
        concurrency TEXT NOT NULL,
        timeout_ms INTEGER NOT NULL,
        max_attempts INTEGER NOT NULL,
        backoff_ms INTEGER NOT NULL,
        next_run_at TEXT,
        last_run_at TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (job_id, plugin_id)
      );
      CREATE TABLE IF NOT EXISTS plugin_job_runs (
        run_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL,
        idempotency_key TEXT,
        request_hash TEXT,
        lease_owner TEXT,
        lease_expires_at TEXT,
        scheduled_for TEXT,
        enqueued_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        last_error TEXT,
        outcome_unknown INTEGER NOT NULL DEFAULT 0,
        cancel_requested INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS plugin_job_runs_queue
        ON plugin_job_runs (status, enqueued_at);
      CREATE INDEX IF NOT EXISTS plugin_job_runs_due
        ON plugin_job_runs (job_id, scheduled_for);
      CREATE INDEX IF NOT EXISTS plugin_job_runs_lease
        ON plugin_job_runs (status, lease_expires_at);
      CREATE UNIQUE INDEX IF NOT EXISTS plugin_job_runs_idempotency
        ON plugin_job_runs (plugin_id, job_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE TABLE IF NOT EXISTS plugin_job_attempts (
        run_id TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        logs TEXT,
        artifacts TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        PRIMARY KEY (run_id, attempt)
      );
    `);
    const columns = db
      .query<{ name: string }, []>("PRAGMA table_info(plugin_job_definitions)")
      .all();
    if (!columns.some((column) => column.name === "interval_ms"))
      db.exec(
        "ALTER TABLE plugin_job_definitions ADD COLUMN interval_ms INTEGER;",
      );
  },
};
