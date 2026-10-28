import type { Database } from "bun:sqlite";
import type { PluginEventPage } from "@northgraindata/dsui-plugin-sdk";

/** Signals from other sources are kept this long. */
export const ACTIVITY_RETENTION_MS = 30 * 24 * 60 * 60_000;
/** Repeats of one signal for one service within this gap collapse into a row. */
const COLLAPSE_WINDOW_MS = 5 * 60_000;
const MAX_PAGES_PER_RUN = 10;
const PAGE_SIZE = 200;
const CURSOR_KEY = "activity_cursor";

export type ActivityEntry = {
  id: number;
  serviceId: string;
  signalId: string;
  type: string;
  time: number;
  summary: string | null;
  count: number;
};

const SUMMARY_KEYS = ["summary", "message", "error", "title", "reason"];

/**
 * A short line describing a signal payload, when it carries one.
 *
 * The plugin knows no particular signal, so it looks for the conventional
 * field names a payload would use to describe itself and ignores the rest.
 */
export function summarize(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of SUMMARY_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim())
      return value.trim().replace(/\s+/g, " ").slice(0, 200);
  }
  return null;
}

/**
 * Records one signal, folding bursts of the same signal into a single row.
 *
 * A noisy signal, such as one fired per successful query, would otherwise
 * bury the few that explain an incident.
 */
export function recordActivity(
  db: Database,
  entry: Omit<ActivityEntry, "id" | "count">,
): void {
  const recent = db
    .query<{ id: number }, [string, string, number]>(
      `SELECT id FROM activity
       WHERE service_id = ? AND signal_id = ? AND time >= ?
       ORDER BY time DESC LIMIT 1`,
    )
    .get(entry.serviceId, entry.signalId, entry.time - COLLAPSE_WINDOW_MS);
  if (recent) {
    db.query(
      "UPDATE activity SET count = count + 1, time = MAX(time, ?), type = ?, summary = COALESCE(?, summary) WHERE id = ?",
    ).run(entry.time, entry.type, entry.summary, recent.id);
    return;
  }
  db.query(
    "INSERT INTO activity (service_id, signal_id, type, time, summary) VALUES (?, ?, ?, ?, ?)",
  ).run(entry.serviceId, entry.signalId, entry.type, entry.time, entry.summary);
}

type Reader = (options?: {
  cursor?: string;
  limit?: number;
}) => Promise<PluginEventPage>;

/** Records one page of signals and advances the cursor, atomically. */
function storePage(
  db: Database,
  page: PluginEventPage,
  ownPrefix: string,
  saveCursor: (cursor: string) => void,
): number {
  return db.transaction(() => {
    let recorded = 0;
    for (const event of page.items) {
      if (!event.serviceId || event.signalId.startsWith(ownPrefix)) continue;
      const time = Date.parse(event.occurredAt);
      if (!Number.isFinite(time)) continue;
      recordActivity(db, {
        serviceId: event.serviceId,
        signalId: event.signalId,
        type: event.type,
        time,
        summary: summarize(event.payload),
      });
      recorded++;
    }
    saveCursor(page.cursor);
    return recorded;
  })();
}

/**
 * Pulls new signals from the host into the activity log.
 *
 * Starts from the current tail on first run, so enabling the plugin does not
 * replay history. Signals without a service are skipped, as are this plugin's
 * own: they describe the incident rather than explain it.
 */
export async function ingestActivity(
  db: Database,
  read: Reader | undefined,
  ownPrefix: string,
): Promise<number> {
  if (!read) return 0;
  const stored = db
    .query<{ value: string }, [string]>("SELECT value FROM meta WHERE key = ?")
    .get(CURSOR_KEY);
  const save = (cursor: string) =>
    db
      .query("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
      .run(CURSOR_KEY, cursor);
  if (!stored) {
    save((await read({ cursor: "latest" })).cursor);
    return 0;
  }
  let cursor = stored.value;
  let recorded = 0;
  for (let pages = 0; pages < MAX_PAGES_PER_RUN; pages++) {
    const page = await read({ cursor, limit: PAGE_SIZE });
    recorded += storePage(db, page, ownPrefix, save);
    cursor = page.cursor;
    if (!page.hasMore) break;
  }
  return recorded;
}

type Row = {
  id: number;
  service_id: string;
  signal_id: string;
  type: string;
  time: number;
  summary: string | null;
  count: number;
};

const toEntry = (row: Row): ActivityEntry => ({
  id: row.id,
  serviceId: row.service_id,
  signalId: row.signal_id,
  type: row.type,
  time: row.time,
  summary: row.summary,
  count: row.count,
});

/** Signals for one service in `[from, to]`, oldest first. */
export function readActivity(
  db: Database,
  serviceId: string,
  from: number,
  to: number,
  limit = 50,
): ActivityEntry[] {
  return db
    .query<Row, [string, number, number, number]>(
      `SELECT * FROM (
         SELECT * FROM activity WHERE service_id = ? AND time >= ? AND time <= ?
         ORDER BY time DESC LIMIT ?
       ) ORDER BY time`,
    )
    .all(serviceId, from, to, limit)
    .map(toEntry);
}

export function pruneActivity(db: Database, now: number): void {
  db.query("DELETE FROM activity WHERE time < ?").run(
    now - ACTIVITY_RETENTION_MS,
  );
}
