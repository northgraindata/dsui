import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

/** Adds severity/category to persisted signals. */
export const migration_0011_event_type: Migration = {
  version: 11,
  name: "event_type",
  up(db: Database): void {
    db.exec(`ALTER TABLE events ADD COLUMN type TEXT NOT NULL DEFAULT 'info';`);
  },
};
