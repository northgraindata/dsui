import type { Database } from "bun:sqlite";
import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
export const DATABASE_NAME = "status-pages";
export const migrations = [
  {
    version: 1,
    name: "status-pages",
    up(db: Database) {
      db.exec(`
        CREATE TABLE status_pages (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          created_by TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE status_page_components (
          id TEXT PRIMARY KEY,
          page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          position INTEGER NOT NULL,
          service_ids_json TEXT NOT NULL
        );
        CREATE INDEX status_page_components_page ON status_page_components(page_id, position);

        CREATE TABLE notices (
          id TEXT PRIMARY KEY,
          page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          impact TEXT NOT NULL,
          status TEXT NOT NULL,
          component_ids_json TEXT NOT NULL,
          source TEXT,
          created_by TEXT,
          created_at INTEGER NOT NULL,
          resolved_at INTEGER
        );
        CREATE INDEX notices_page ON notices(page_id, created_at);

        CREATE TABLE notice_updates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
          time INTEGER NOT NULL,
          status TEXT NOT NULL,
          message TEXT NOT NULL,
          author TEXT
        );
        CREATE INDEX notice_updates_notice ON notice_updates(notice_id, time);
      `);
    },
  },
];
export function applyMigrations(db: Database): Database {
  db.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)",
  );
  if (!db.query("SELECT version FROM schema_migrations WHERE version=1").get())
    db.transaction(() => {
      for (const migration of migrations) migration.up(db);
      db.query(
        "INSERT INTO schema_migrations VALUES (1, 'status-pages', ?)",
      ).run(Date.now());
    })();
  return db;
}
const opened = new WeakMap<object, Database>();
export function openStatusDb(storage: PluginStorage): Database {
  const cached = opened.get(storage);
  if (cached) return cached;
  const db = storage.migrate
    ? storage.migrate(DATABASE_NAME, migrations)
    : applyMigrations(storage.openDatabase(DATABASE_NAME));
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  opened.set(storage, db);
  return db;
}
