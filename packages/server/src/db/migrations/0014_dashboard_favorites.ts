import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0014_dashboard_favorites: Migration = {
  version: 14,
  name: "dashboard_favorites",
  up(db: Database): void {
    db.exec(`CREATE TABLE IF NOT EXISTS dashboard_favorites (
      principal_id TEXT NOT NULL,
      dashboard_name TEXT NOT NULL,
      PRIMARY KEY (principal_id, dashboard_name)
    );`);
  },
};
