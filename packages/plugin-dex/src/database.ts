import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";

type Database = ReturnType<PluginStorage["openDatabase"]>;

const MIGRATIONS = [
  {
    version: 1,
    name: "view results",
    up: (database: Database) => {
      database.exec(`CREATE TABLE view_results (
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        state TEXT NOT NULL,
        message TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        content TEXT,
        content_at TEXT,
        PRIMARY KEY (project_id, kind)
      )`);
    },
  },
  {
    version: 2,
    name: "check runs and schedules",
    up: (database: Database) => {
      database.exec(`CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        steps TEXT NOT NULL,
        findings TEXT NOT NULL,
        finding_count INTEGER NOT NULL,
        problem_count INTEGER NOT NULL,
        not_checked TEXT NOT NULL
      )`);
      database.exec(
        "CREATE INDEX runs_by_project ON runs (project_id, created_at DESC)",
      );
      database.exec(`CREATE TABLE schedules (
        project_id TEXT PRIMARY KEY,
        interval_minutes INTEGER NOT NULL,
        next_run_at TEXT NOT NULL
      )`);
    },
  },
  {
    version: 3,
    name: "multiple check schedules and command output",
    up: (database: Database) => {
      database.exec(`
        CREATE TABLE schedule_rules (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          rule TEXT NOT NULL,
          enabled INTEGER NOT NULL,
          next_run_at TEXT,
          time_zone TEXT
        );
        CREATE INDEX schedule_rules_by_project ON schedule_rules (project_id, next_run_at);
        CREATE INDEX schedule_rules_by_due ON schedule_rules (next_run_at);
        INSERT INTO schedule_rules (id, project_id, rule, enabled, next_run_at)
          SELECT 'legacy:' || project_id, project_id,
                 json_object('kind', 'interval', 'intervalMinutes', interval_minutes),
                 1, next_run_at
          FROM schedules;
        DROP TABLE schedules;
        ALTER TABLE runs ADD COLUMN schedule_id TEXT;
        ALTER TABLE runs ADD COLUMN scheduled_for TEXT;
        ALTER TABLE runs ADD COLUMN captures_output INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE run_outputs (
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          command TEXT NOT NULL,
          status TEXT NOT NULL,
          state TEXT NOT NULL,
          message TEXT NOT NULL,
          json TEXT,
          PRIMARY KEY (run_id, command)
        );
      `);
    },
  },
  {
    version: 4,
    name: "selected Dex commands",
    up: (database: Database) => {
      database.exec(`
        ALTER TABLE runs ADD COLUMN commands TEXT;
        ALTER TABLE schedule_rules ADD COLUMN commands TEXT;
      `);
    },
  },
];

export function database(storage: PluginStorage): Database {
  if (!storage.migrate)
    throw new Error("The Dex plugin needs a DSUI host with plugin migrations");
  return storage.migrate("dex", MIGRATIONS);
}
