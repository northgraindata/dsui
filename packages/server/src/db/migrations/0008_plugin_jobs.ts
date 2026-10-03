import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

/**
 * Durable plugin job definitions, runs, attempts and leases.
 *
 * A job definition is registered when a plugin loads and is not a queue row:
 * it is the plugin's own contribution, kept under its id so a plugin that is
 * disabled leaves nothing behind. A run is one attempt at that job, and its
 * state lives in the database rather than in the process, so a restart finds
 * work that was already claimed instead of losing it.
 *
 * The lease is what makes the queue safe with more than one process. A run is
 * claimed by writing `lease_owner` and `lease_expires_at` in the same
 * transaction that moves it out of the queue, and only the holder of an
 * unexpired lease may finish it. A worker that dies leaves the lease to expire
 * and the run to be reclaimed, which is why an expiry column exists at all: a
 * run cannot be recovered from a process that never says it is gone.
 *
 * Idempotency is keyed on the requester, the job and a caller-supplied key,
 * with the payload hash stored beside it. Reusing a key with a different
 * payload is a caller bug and is rejected rather than silently run: two jobs
 * under one key would mean the second one's output overwrote the first's while
 * both report success.
 */
export const migration_0008_plugin_jobs: Migration = {
  version: 8,
  name: "plugin-jobs",
  up(db: Database): void {
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
  },
};
