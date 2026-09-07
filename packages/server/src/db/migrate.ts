import type { Database } from "bun:sqlite";

/** One numbered schema migration. Versions are dense, starting at 1. */
export interface Migration {
  readonly version: number;
  /** Short slug for logs, e.g. "init". */
  readonly name: string;
  /** Applies the migration. Runs inside a transaction. */
  up(db: Database): void;
}

/**
 * Applies pending migrations in version order, recording each in
 * schema_migrations. Every migration runs in its own transaction;
 * reruns are no-ops.
 */
export function runMigrations(db: Database, migrations: Migration[]): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
  );
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  for (const migration of ordered) {
    const applied = db
      .query<{ version: number }, [number]>(
        "SELECT version FROM schema_migrations WHERE version = ?",
      )
      .get(migration.version);
    if (applied) continue;
    const apply = db.transaction(() => {
      migration.up(db);
      db.query(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(migration.version, new Date().toISOString());
    });
    apply();
  }
}
