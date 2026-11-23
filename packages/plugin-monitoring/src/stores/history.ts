import type {
  DiagnosticOperation,
  PluginStorage,
} from "@northgraindata/dsui-plugin-sdk";
import type { SeriesPoint, SeriesWindow } from "./series.js";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function database(storage: PluginStorage) {
  const db = storage.openDatabase("resource-history");
  db.exec(`CREATE TABLE IF NOT EXISTS samples (
    time INTEGER PRIMARY KEY, cpu REAL NOT NULL, memory REAL NOT NULL, disk REAL
  )`);
  return db;
}

export function recordSample(
  storage: PluginStorage,
  sample: { time: number; cpu: number; memory: number; disk: number | null },
) {
  const { time, cpu, memory, disk } = sample;
  const db = database(storage);
  db.query(
    "INSERT OR REPLACE INTO samples (time, cpu, memory, disk) VALUES (?, ?, ?, ?)",
  ).run(time, cpu, memory, disk);
  db.query("DELETE FROM samples WHERE time < ?").run(time - RETENTION_MS);
}

export function recordOperations(
  storage: PluginStorage,
  operations: readonly DiagnosticOperation[],
  time = Date.now(),
) {
  const db = database(storage);
  db.exec(`CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY, adapterId TEXT NOT NULL, serviceId TEXT,
    kind TEXT NOT NULL, startedAt INTEGER NOT NULL, durationMs REAL NOT NULL, outcome TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS operations_time ON operations(startedAt);`);
  const insert = db.query(
    "INSERT INTO operations VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET durationMs=excluded.durationMs, outcome=excluded.outcome WHERE operations.outcome = 'active'",
  );
  db.transaction(() => {
    for (const op of operations)
      insert.run(
        op.id,
        op.adapterId,
        op.serviceId,
        op.kind,
        op.startedAt,
        op.durationMs,
        op.outcome,
      );
    db.query("DELETE FROM operations WHERE startedAt < ?").run(
      time - RETENTION_MS,
    );
    db.exec(
      "DELETE FROM operations WHERE id IN (SELECT id FROM operations ORDER BY startedAt DESC LIMIT -1 OFFSET 10000)",
    );
  })();
}

export function recentOperations(storage: PluginStorage) {
  recordOperations(storage, []);
  const db = database(storage);
  return db
    .query<DiagnosticOperation, []>(
      "SELECT * FROM operations ORDER BY startedAt DESC LIMIT 50",
    )
    .all();
}

/** Aggregate inside SQLite rather than loading seven days into JavaScript on each poll. */
export function readWindow(
  storage: PluginStorage,
  series: "cpu" | "memory" | "disk",
  secs: number,
  label: string,
): SeriesWindow {
  const bucket = Math.max(10000, Math.round(secs / 400) * 1000);
  const db = database(storage);
  const points = db
    .query<
      SeriesPoint & { count: number; min: number; max: number },
      [number, number]
    >(
      `SELECT CAST(time / ? AS INTEGER) * ${bucket} AS time, AVG(${series}) AS value, MIN(${series}) AS min, MAX(${series}) AS max, COUNT(*) AS count FROM samples WHERE time >= ? AND ${series} IS NOT NULL GROUP BY 1 ORDER BY 1`,
    )
    .all(bucket, Date.now() - secs * 1000);
  return {
    label,
    secs,
    points,
    sampleCount: points.reduce((sum, point) => sum + point.count, 0),
  };
}

export function recordRuntime(
  storage: PluginStorage,
  time: number,
  metrics: Record<string, unknown>,
) {
  const db = database(storage);
  db.exec(
    "CREATE TABLE IF NOT EXISTS runtime_samples (time INTEGER PRIMARY KEY, metrics TEXT NOT NULL)",
  );
  db.query("INSERT OR REPLACE INTO runtime_samples VALUES (?, ?)").run(
    time,
    JSON.stringify(metrics),
  );
  db.query("DELETE FROM runtime_samples WHERE time < ?").run(
    time - RETENTION_MS,
  );
}

export function recentRuntime(
  storage: PluginStorage,
): { time: number; metrics: Record<string, unknown> }[] {
  const db = database(storage);
  db.exec(
    "CREATE TABLE IF NOT EXISTS runtime_samples (time INTEGER PRIMARY KEY, metrics TEXT NOT NULL)",
  );
  return db
    .query<{ time: number; metrics: string }, []>(
      "SELECT * FROM runtime_samples ORDER BY time DESC LIMIT 30",
    )
    .all()
    .map((row) => ({ time: row.time, metrics: JSON.parse(row.metrics) }));
}
