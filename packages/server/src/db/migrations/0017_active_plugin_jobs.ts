import type { Migration } from "../migrate.js";

export const migration_0017_active_plugin_jobs: Migration = {
  version: 17,
  name: "active_plugin_jobs",
  up(db): void {
    db.exec(`
      CREATE INDEX plugin_job_runs_active_by_job
      ON plugin_job_runs (plugin_id, job_id, status)
      WHERE status IN ('queued', 'running');
    `);
  },
};
