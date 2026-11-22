import type { Migration } from "../migrate.js";

export const migration_0018_scheduled_job_retention: Migration = {
  version: 18,
  name: "scheduled_job_retention",
  up(db): void {
    db.exec(`
      ALTER TABLE plugin_job_runs
        ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';

      UPDATE plugin_job_runs SET origin = 'schedule'
      WHERE scheduled_for IS NOT NULL AND attempt_count = 1
        AND idempotency_key IS NULL;

      CREATE INDEX plugin_job_runs_retention
      ON plugin_job_runs (finished_at)
      WHERE status = 'succeeded' AND origin = 'schedule'
        AND idempotency_key IS NULL;
    `);
  },
};
