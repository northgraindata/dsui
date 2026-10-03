import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0007_remove_legacy_enterprise: Migration = {
  version: 7,
  name: "remove-legacy-enterprise",
  up(db: Database): void {
    db.exec(`
      DROP TABLE IF EXISTS enterprise_sso_providers;
      DROP TABLE IF EXISTS enterprise_memberships;
      DROP TABLE IF EXISTS account;
      DROP TABLE IF EXISTS session;
      DROP TABLE IF EXISTS verification;
      DROP TABLE IF EXISTS "user";
    `);
  },
};
