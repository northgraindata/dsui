import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

/** Records which person's request caused a signal, when one did. */
export const migration_0016_event_actor: Migration = {
  version: 16,
  name: "event_actor",
  up(db: Database): void {
    db.exec(`ALTER TABLE events ADD COLUMN actor_id TEXT;`);
  },
};
