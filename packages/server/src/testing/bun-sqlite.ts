/**
 * Test-only stand-in for `bun:sqlite`. The class extends the real native SQLite
 * constructor (bun:sqlite under Bun, node:sqlite DatabaseSync under Node) so
 * that libraries performing `instanceof` checks (e.g. better-auth's Kysely
 * adapter) recognize it. Unit tests run under Node here, so this keeps them
 * hermetic without changing production behavior under Bun.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

interface NativeStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
}
interface NativeDatabase {
  exec(sql: string): unknown;
  query(sql: string): NativeStatement;
  prepare(sql: string): NativeStatement;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

async function loadNativeCtor(): Promise<
  new (
    path: string,
    options?: { create?: boolean; allowCreate?: boolean },
  ) => NativeDatabase
> {
  if (isBun) {
    const { Database } = require("bun:sqlite") as {
      Database: new (
        path: string,
        options?: { create?: boolean },
      ) => NativeDatabase;
    };
    return Database;
  }
  const mod = await import("node:sqlite");
  return mod.DatabaseSync as unknown as new (
    path: string,
    options?: { allowCreate?: boolean },
  ) => NativeDatabase;
}

const NativeCtor = await loadNativeCtor();

const nativeHasQuery =
  typeof (NativeCtor.prototype as { query?: unknown }).query === "function";

export class Database extends (NativeCtor as new (
  path: string,
  options?: { create?: boolean; allowCreate?: boolean },
) => NativeDatabase) {
  constructor(path: string, options?: { create?: boolean }) {
    super(
      path === ":memory:" ? ":memory:" : path,
      isBun ? options : { allowCreate: true },
    );
    this.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  }

  query(sql: string): NativeStatement {
    return nativeHasQuery
      ? (super.query(sql) as NativeStatement)
      : this.prepare(sql);
  }

  // Node's StatementSync (this Node build) lacks `.columns()`, which
  // better-auth's Kysely dialect relies on to decide between `all`/`run`.
  // Attach a shape-compatible shim keyed off the statement kind.
  prepare(sql: string): NativeStatement {
    const stmt = super.prepare(sql) as NativeStatement & {
      columns?: () => unknown[];
    };
    if (typeof stmt.columns !== "function") {
      const returnsRows =
        /returning\s/i.test(sql) ||
        /^\s*(select|with|pragma|explain|values)\b/i.test(sql);
      stmt.columns = () => (returnsRows ? [{} as unknown] : []);
    }
    return stmt;
  }

  // Node's DatabaseSync has no transaction helper; bun:sqlite does. Provide a
  // portable implementation so callers can rely on it in either runtime.
  transaction<T>(fn: () => T): () => T {
    return () => {
      this.exec("BEGIN");
      try {
        const result = fn();
        this.exec("COMMIT");
        return result;
      } catch (error) {
        this.exec("ROLLBACK");
        throw error;
      }
    };
  }
}
