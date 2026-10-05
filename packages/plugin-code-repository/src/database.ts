import type { Database } from "bun:sqlite";
import { z } from "@northgraindata/dsui-plugin-sdk";
import {
  type Connection,
  type Context,
  connectionSchema,
  previewLimit,
  type SnapshotFile,
} from "./model";

const storedSchema = connectionSchema.extend({
  id: z.string().uuid(),
  configKey: z.string().optional(),
  revision: z.number(),
  status: z.enum(["idle", "queued", "syncing", "ready", "error"]),
  lastAttemptAt: z.string().nullable(),
  lastFetchedAt: z.string().nullable(),
  error: z.string().nullable(),
  version: z.string().nullable(),
});
export function database(context: Pick<Context, "storage">): Database {
  const db = context.storage.openDatabase("repositories");
  db.exec(`CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, service_id TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files (connection_id TEXT NOT NULL, path TEXT NOT NULL, bytes BLOB NOT NULL, size INTEGER NOT NULL, PRIMARY KEY(connection_id, path));`);
  return db;
}
export function connections(db: Database): Connection[] {
  return db
    .query<{ data: string }, []>(
      "SELECT data FROM connections ORDER BY service_id, id",
    )
    .all()
    .map((row) => storedSchema.parse(JSON.parse(row.data)));
}
export function connection(db: Database, id: string): Connection | null {
  const row = db
    .query<{ data: string }, [string]>(
      "SELECT data FROM connections WHERE id = ?",
    )
    .get(id);
  return row ? storedSchema.parse(JSON.parse(row.data)) : null;
}
export function writeConnection(db: Database, item: Connection): void {
  db.query(
    "INSERT INTO connections(id, service_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, service_id = excluded.service_id",
  ).run(item.id, item.serviceId, JSON.stringify(item));
}
export function deleteConnection(db: Database, id: string): void {
  db.transaction(() => {
    db.query("DELETE FROM files WHERE connection_id = ?").run(id);
    db.query("DELETE FROM connections WHERE id = ?").run(id);
  })();
}
export function publishSnapshot(
  db: Database,
  item: Connection,
  files: SnapshotFile[],
): void {
  db.transaction(() => {
    db.query("DELETE FROM files WHERE connection_id = ?").run(item.id);
    const insert = db.query(
      "INSERT INTO files(connection_id,path,bytes,size) VALUES (?,?,?,?)",
    );
    for (const file of files)
      insert.run(item.id, file.path, file.bytes, file.size);
    writeConnection(db, item);
  })();
}
export function listFiles(
  db: Database,
  id: string,
): Array<{ path: string; size: number }> {
  return db
    .query<{ path: string; size: number }, [string]>(
      "SELECT path, size FROM files WHERE connection_id = ? ORDER BY path",
    )
    .all(id);
}
export function readFile(db: Database, id: string, path: string) {
  return db
    .query<{ bytes: Uint8Array; size: number }, [number, string, string]>(
      "SELECT CASE WHEN size <= ? THEN bytes ELSE X'' END AS bytes, size FROM files WHERE connection_id = ? AND path = ?",
    )
    .get(previewLimit, id, path);
}
