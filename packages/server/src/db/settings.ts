import type { Database } from "bun:sqlite";
import type { z } from "zod";

export function readSettings<T>(
  db: Database,
  scope: string,
  owner: string,
  schema: z.ZodType<T>,
  defaults: T,
) {
  const row = db
    .query<{ value: string; revision: number }, [string, string]>(
      "SELECT value, revision FROM settings WHERE scope = ? AND owner = ?",
    )
    .get(scope, owner);
  return row
    ? { value: schema.parse(JSON.parse(row.value)), revision: row.revision }
    : { value: defaults, revision: 0 };
}

/** Compare-and-swap keeps a stale browser from overwriting another save. */
export function writeSettings(
  db: Database,
  scope: string,
  owner: string,
  value: unknown,
  revision: number,
): boolean {
  return db.transaction(() => {
    const current = db
      .query<{ revision: number }, [string, string]>(
        "SELECT revision FROM settings WHERE scope = ? AND owner = ?",
      )
      .get(scope, owner);
    if ((current?.revision ?? 0) !== revision) return false;
    db.query(`INSERT INTO settings(scope, owner, value, revision) VALUES (?, ?, ?, 1)
      ON CONFLICT(scope, owner) DO UPDATE SET value = excluded.value, revision = settings.revision + 1`).run(
      scope,
      owner,
      JSON.stringify(value),
    );
    return true;
  })();
}
