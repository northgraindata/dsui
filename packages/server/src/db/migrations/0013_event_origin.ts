import type { Migration } from "../migrate.js";
export const migration_0013_event_origin: Migration = {
  version: 13,
  name: "event_origin",
  up(db) {
    db.exec("ALTER TABLE events ADD COLUMN origin_json TEXT");
  },
};
