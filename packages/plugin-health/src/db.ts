import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
import { rebuildRollups } from "./repo.js";

/** The plugin's database name (`<plugin directory>/health.sqlite`). */
export const DATABASE_NAME = "health";
/** The database the first version of this plugin wrote its history to. */
const LEGACY_DATABASE_NAME = "health-history";

export type Migration = {
  readonly version: number;
  readonly name: string;
  up(db: Database): void;
};

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "initial-schema",
    up(db) {
      db.exec(`
        CREATE TABLE samples (
          service_id TEXT NOT NULL,
          time INTEGER NOT NULL,
          health TEXT NOT NULL,
          latency_ms REAL,
          score REAL,
          detail TEXT,
          checks_json TEXT,
          maintenance INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (service_id, time)
        );
        CREATE INDEX samples_time ON samples(time);

        CREATE TABLE rollups (
          service_id TEXT NOT NULL,
          granularity TEXT NOT NULL,
          bucket INTEGER NOT NULL,
          data_json TEXT NOT NULL,
          PRIMARY KEY (service_id, granularity, bucket)
        );
        CREATE INDEX rollups_bucket ON rollups(granularity, bucket);

        CREATE TABLE service_state (
          service_id TEXT PRIMARY KEY,
          health TEXT NOT NULL,
          since INTEGER NOT NULL,
          pending TEXT,
          pending_count INTEGER NOT NULL DEFAULT 0,
          next_due_at INTEGER NOT NULL,
          last_checked_at INTEGER NOT NULL,
          last_health TEXT NOT NULL,
          last_detail TEXT,
          last_latency_ms REAL,
          last_score REAL,
          last_checks_json TEXT
        );

        CREATE TABLE check_transitions (
          service_id TEXT NOT NULL,
          check_id TEXT NOT NULL,
          time INTEGER NOT NULL,
          label TEXT NOT NULL,
          ok INTEGER NOT NULL,
          detail TEXT,
          PRIMARY KEY (service_id, check_id, time)
        );
        CREATE INDEX check_transitions_time ON check_transitions(service_id, time);

        CREATE TABLE incidents (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL,
          status TEXT NOT NULL,
          severity TEXT NOT NULL,
          peak_severity TEXT NOT NULL,
          summary TEXT NOT NULL,
          opened_at INTEGER NOT NULL,
          acknowledged_at INTEGER,
          acknowledged_by TEXT,
          resolved_at INTEGER,
          resolved_by TEXT,
          resolution_note TEXT
        );
        CREATE INDEX incidents_service ON incidents(service_id, opened_at);
        CREATE INDEX incidents_status ON incidents(status, opened_at);

        CREATE TABLE incident_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          incident_id TEXT NOT NULL,
          time INTEGER NOT NULL,
          kind TEXT NOT NULL,
          actor TEXT,
          message TEXT,
          detail_json TEXT
        );
        CREATE INDEX incident_events_incident ON incident_events(incident_id, time);

        CREATE TABLE suppressions (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          service_id TEXT,
          starts_at INTEGER NOT NULL,
          ends_at INTEGER NOT NULL,
          reason TEXT,
          created_by TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX suppressions_window ON suppressions(starts_at, ends_at);

        CREATE TABLE slo_targets (
          service_id TEXT PRIMARY KEY,
          target_percent REAL NOT NULL,
          window_days INTEGER NOT NULL,
          updated_by TEXT,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      `);
    },
  },
  {
    version: 2,
    name: "activity-log",
    up(db) {
      db.exec(`
        CREATE TABLE activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          service_id TEXT NOT NULL,
          signal_id TEXT NOT NULL,
          type TEXT NOT NULL,
          time INTEGER NOT NULL,
          summary TEXT,
          count INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX activity_service_time ON activity(service_id, time);
        CREATE INDEX activity_time ON activity(time);
      `);
    },
  },
];

/**
 * Applies pending migrations in order, recording each in `schema_migrations`.
 *
 * Used when the host does not provide `storage.migrate`, so the schema is
 * created the same way in tests and on older hosts.
 */
export function applyMigrations(
  db: Database,
  list: readonly Migration[] = migrations,
): Database {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)",
  );
  const applied = new Set(
    db
      .query<{ version: number }, []>("SELECT version FROM schema_migrations")
      .all()
      .map((row) => row.version),
  );
  for (const migration of list) {
    if (applied.has(migration.version)) continue;
    db.transaction(() => {
      migration.up(db);
      db.query(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, Date.now());
    })();
  }
  return db;
}

const opened = new WeakMap<object, Database>();

/**
 * Opens the plugin database with its schema up to date.
 *
 * The handle is cached per storage object; the host owns closing it when the
 * plugin stops.
 */
export function openHealthDb(storage: PluginStorage): Database {
  const cached = opened.get(storage);
  if (cached) return cached;
  const db = storage.migrate
    ? storage.migrate(DATABASE_NAME, [...migrations])
    : applyMigrations(storage.openDatabase(DATABASE_NAME));
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  opened.set(storage, db);
  if (importLegacyHistory(storage, db) > 0) rebuildRollups(db);
  return db;
}

/**
 * Copies history from the first version's database, once.
 *
 * The old file is opened only if it exists: opening creates a database, and a
 * fresh install should not leave an empty one behind. The old file is left in
 * place so a downgrade still finds its data.
 */
export function importLegacyHistory(
  storage: PluginStorage,
  db: Database,
  now = Date.now(),
): number {
  const done = db
    .query<{ value: string }, []>(
      "SELECT value FROM meta WHERE key = 'legacy_imported'",
    )
    .get();
  if (done) return 0;
  const directory = storage.directory?.();
  if (
    directory === undefined ||
    !existsSync(join(directory, `${LEGACY_DATABASE_NAME}.sqlite`))
  ) {
    markImported(db, 0, now);
    return 0;
  }
  const legacy = storage.openDatabase(LEGACY_DATABASE_NAME);
  const hasTable = legacy
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'checks'",
    )
    .get();
  if (!hasTable) {
    markImported(db, 0, now);
    return 0;
  }
  const rows = legacy
    .query<
      {
        service_id: string;
        time: number;
        health: string;
        latency_ms: number | null;
      },
      []
    >("SELECT service_id, time, health, latency_ms FROM checks")
    .all();
  const insert = db.query(
    "INSERT OR IGNORE INTO samples (service_id, time, health, latency_ms) VALUES (?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const row of rows)
      insert.run(row.service_id, row.time, row.health, row.latency_ms);
  })();
  markImported(db, rows.length, now);
  return rows.length;
}

function markImported(db: Database, count: number, now: number): void {
  db.query(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('legacy_imported', ?)",
  ).run(JSON.stringify({ count, at: now }));
}
