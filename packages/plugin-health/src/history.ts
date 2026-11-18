import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
import type { ProbeResult } from "./context.js";
import {
  HISTORY_RETENTION_MS,
  HISTORY_WINDOW_MS,
  type HistoryPoint,
} from "./history-model.js";

// The host caches this handle and closes it when the plugin stops.
function open(storage: PluginStorage) {
  const db = storage.openDatabase("health-history");
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS checks (
      service_id TEXT NOT NULL, time INTEGER NOT NULL, health TEXT NOT NULL,
      latency_ms REAL, PRIMARY KEY(service_id, time)
    );
    CREATE INDEX IF NOT EXISTS checks_time ON checks(time);`);
  return db;
}

export function recordChecks(
  storage: PluginStorage,
  results: readonly ProbeResult[],
  time = Date.now(),
) {
  const db = open(storage);
  const insert = db.prepare(
    "INSERT OR REPLACE INTO checks (service_id, time, health, latency_ms) VALUES (?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const result of results)
      insert.run(result.id, time, result.health, result.latencyMs ?? null);
    db.query("DELETE FROM checks WHERE time < ?").run(
      time - HISTORY_RETENTION_MS,
    );
  })();
}

/** Read only IDs authorized by the request's service catalog. */
export function readHistory(
  storage: PluginStorage,
  serviceIds: readonly string[],
  now = Date.now(),
): Map<string, HistoryPoint[]> {
  const db = open(storage);
  const query = db.query<
    {
      time: number;
      health: HistoryPoint["health"];
      latencyMs: number | null;
    },
    [string, number, number]
  >(
    "SELECT time, health, latency_ms AS latencyMs FROM checks WHERE service_id = ? AND time >= ? AND time <= ? ORDER BY time",
  );
  return new Map(
    serviceIds.map((id) => [id, query.all(id, now - HISTORY_WINDOW_MS, now)]),
  );
}
