import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0004_mock_settings: Migration = {
  version: 4,
  name: "mock-settings",
  up(db: Database): void {
    db.exec(`ALTER TABLE ui_services ADD COLUMN mock_settings TEXT;`);
  },
};
