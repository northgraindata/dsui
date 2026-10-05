import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0012_event_sequence: Migration = {
  version: 12,
  name: "event_sequence",
  up(db: Database): void {
    db.exec(`CREATE TABLE event_sequence (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE
    );
    INSERT INTO event_sequence(event_id) SELECT id FROM events ORDER BY occurred_at, rowid;
    CREATE TRIGGER events_assign_sequence AFTER INSERT ON events BEGIN
      INSERT INTO event_sequence(event_id) VALUES (NEW.id);
    END;`);
  },
};
