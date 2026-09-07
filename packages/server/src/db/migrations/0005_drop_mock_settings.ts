import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0005_drop_mock_settings: Migration = {
  version: 5,
  name: "drop-mock-settings",
  // The mock adapter is gone; its plaintext settings column goes with it.
  // Encrypted connections are untouched.
  up(db: Database): void {
    db.exec(`ALTER TABLE ui_services DROP COLUMN mock_settings;`);
  },
};
