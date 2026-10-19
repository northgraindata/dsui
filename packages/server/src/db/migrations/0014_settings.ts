import type { Migration } from "../migrate";

export const migration_0014_settings: Migration = {
  version: 14,
  name: "settings",
  up(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS settings (
      scope TEXT NOT NULL,
      owner TEXT NOT NULL,
      value TEXT NOT NULL,
      revision INTEGER NOT NULL,
      PRIMARY KEY (scope, owner)
    );`);
  },
};
