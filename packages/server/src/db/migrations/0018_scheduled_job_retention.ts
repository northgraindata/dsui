import type { Migration } from "../migrate.js";

export const migration_0018_scheduled_job_retention: Migration = {
  version: 18,
  name: "scheduled_job_retention",
  up(db): void {
    db.exec(`
      CREATE INDEX plugin_job_runs_retention
      ON plugin_job_runs (finished_at)
      WHERE status = 'succeeded' AND scheduled_for IS NOT NULL
        AND idempotency_key IS NULL;
    `);
  },
};
