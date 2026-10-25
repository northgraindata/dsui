import type { Database } from "bun:sqlite";
import type { Health } from "./context.js";
import {
  addSample,
  bucketStart,
  DAY_MS,
  emptyRollup,
  type Granularity,
  HOUR_MS,
  type Rollup,
} from "./rollups.js";
import type { StateCore } from "./state.js";

/** Hourly rollups are only needed for the short, high resolution ranges. */
export const HOUR_ROLLUP_RETENTION_MS = 35 * DAY_MS;

export type CheckResult = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  /** Path inside the service workspace, already validated. */
  href?: string;
};

export type SampleInput = {
  serviceId: string;
  time: number;
  health: Health;
  latencyMs: number | null;
  score: number | null;
  detail: string | null;
  checks: readonly CheckResult[] | null;
  maintenance: boolean;
};

export type Sample = Omit<SampleInput, "serviceId" | "maintenance"> & {
  maintenance: boolean;
};

function readRollup(
  db: Database,
  serviceId: string,
  granularity: Granularity,
  bucket: number,
): Rollup {
  const row = db
    .query<{ data_json: string }, [string, string, number]>(
      "SELECT data_json FROM rollups WHERE service_id = ? AND granularity = ? AND bucket = ?",
    )
    .get(serviceId, granularity, bucket);
  if (!row) return emptyRollup();
  return { ...emptyRollup(), ...(JSON.parse(row.data_json) as Rollup) };
}

function writeRollup(
  db: Database,
  serviceId: string,
  granularity: Granularity,
  bucket: number,
  rollup: Rollup,
): void {
  db.query(
    "INSERT OR REPLACE INTO rollups (service_id, granularity, bucket, data_json) VALUES (?, ?, ?, ?)",
  ).run(serviceId, granularity, bucket, JSON.stringify(rollup));
}

/**
 * Stores one sample and folds it into the hourly and daily rollups.
 *
 * Rollups are the long-range record: raw samples are pruned after days, but
 * the rollups answer a 90 day uptime question from a handful of rows.
 */
export function recordSample(db: Database, input: SampleInput): void {
  db.transaction(() => {
    const replaced = db
      .query<
        { health: Health; latency_ms: number | null; maintenance: number },
        [string, number]
      >(
        "SELECT health, latency_ms, maintenance FROM samples WHERE service_id = ? AND time = ?",
      )
      .get(input.serviceId, input.time);
    // A sample at an existing timestamp replaces it; rebuild instead of
    // double counting the rollups.
    db.query(
      `INSERT OR REPLACE INTO samples
        (service_id, time, health, latency_ms, score, detail, checks_json, maintenance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.serviceId,
      input.time,
      input.health,
      input.latencyMs,
      input.score,
      input.detail,
      input.checks ? JSON.stringify(input.checks) : null,
      input.maintenance ? 1 : 0,
    );
    if (replaced) {
      rebuildRollupsFor(db, input.serviceId, input.time);
      return;
    }
    for (const granularity of ["hour", "day"] as const) {
      const bucket = bucketStart(input.time, granularity);
      writeRollup(
        db,
        input.serviceId,
        granularity,
        bucket,
        addSample(readRollup(db, input.serviceId, granularity, bucket), input),
      );
    }
  })();
}

function rebuildRollupsFor(db: Database, serviceId: string, time: number) {
  for (const granularity of ["hour", "day"] as const) {
    const start = bucketStart(time, granularity);
    const end = start + (granularity === "hour" ? HOUR_MS : DAY_MS);
    let rollup = emptyRollup();
    for (const row of db
      .query<
        { health: Health; latency_ms: number | null; maintenance: number },
        [string, number, number]
      >(
        "SELECT health, latency_ms, maintenance FROM samples WHERE service_id = ? AND time >= ? AND time < ?",
      )
      .all(serviceId, start, end))
      rollup = addSample(rollup, {
        health: row.health,
        latencyMs: row.latency_ms,
        maintenance: row.maintenance === 1,
      });
    writeRollup(db, serviceId, granularity, start, rollup);
  }
}

/** Recomputes every rollup from raw samples. Used after importing history. */
export function rebuildRollups(db: Database): void {
  const rollups = new Map<string, Rollup>();
  for (const row of db
    .query<
      {
        service_id: string;
        time: number;
        health: Health;
        latency_ms: number | null;
        maintenance: number;
      },
      []
    >(
      "SELECT service_id, time, health, latency_ms, maintenance FROM samples ORDER BY time",
    )
    .all())
    for (const granularity of ["hour", "day"] as const) {
      const key = `${row.service_id}\u0000${granularity}\u0000${bucketStart(row.time, granularity)}`;
      rollups.set(
        key,
        addSample(rollups.get(key) ?? emptyRollup(), {
          health: row.health,
          latencyMs: row.latency_ms,
          maintenance: row.maintenance === 1,
        }),
      );
    }
  db.transaction(() => {
    db.exec("DELETE FROM rollups");
    for (const [key, rollup] of rollups) {
      const [serviceId, granularity, bucket] = key.split("\u0000");
      writeRollup(
        db,
        serviceId ?? "",
        granularity as Granularity,
        Number(bucket),
        rollup,
      );
    }
  })();
}

/** Rollup buckets in `[from, to]`, keyed by bucket start. */
export function readRollups(
  db: Database,
  serviceId: string,
  granularity: Granularity,
  from: number,
  to: number,
): Map<number, Rollup> {
  const result = new Map<number, Rollup>();
  for (const row of db
    .query<
      { bucket: number; data_json: string },
      [string, string, number, number]
    >(
      "SELECT bucket, data_json FROM rollups WHERE service_id = ? AND granularity = ? AND bucket >= ? AND bucket <= ? ORDER BY bucket",
    )
    .all(serviceId, granularity, bucketStart(from, granularity), to))
    result.set(row.bucket, {
      ...emptyRollup(),
      ...(JSON.parse(row.data_json) as Rollup),
    });
  return result;
}

/** Raw samples in `[from, to]`, oldest first. */
export function readSamples(
  db: Database,
  serviceId: string,
  from: number,
  to: number,
  limit = 5_000,
): Sample[] {
  return db
    .query<
      {
        time: number;
        health: Health;
        latency_ms: number | null;
        score: number | null;
        detail: string | null;
        checks_json: string | null;
        maintenance: number;
      },
      [string, number, number, number]
    >(
      `SELECT time, health, latency_ms, score, detail, checks_json, maintenance
       FROM samples WHERE service_id = ? AND time >= ? AND time <= ?
       ORDER BY time LIMIT ?`,
    )
    .all(serviceId, from, to, limit)
    .map((row) => ({
      time: row.time,
      health: row.health,
      latencyMs: row.latency_ms,
      score: row.score,
      detail: row.detail,
      checks: row.checks_json
        ? (JSON.parse(row.checks_json) as CheckResult[])
        : null,
      maintenance: row.maintenance === 1,
    }));
}

export type StateRow = StateCore & {
  serviceId: string;
  nextDueAt: number;
  lastCheckedAt: number;
  lastHealth: Health;
  lastDetail: string | null;
  lastLatencyMs: number | null;
  lastScore: number | null;
  lastChecks: CheckResult[] | null;
};

type StateRecord = {
  service_id: string;
  health: Health;
  since: number;
  pending: Health | null;
  pending_count: number;
  next_due_at: number;
  last_checked_at: number;
  last_health: Health;
  last_detail: string | null;
  last_latency_ms: number | null;
  last_score: number | null;
  last_checks_json: string | null;
};

function toState(row: StateRecord): StateRow {
  return {
    serviceId: row.service_id,
    health: row.health,
    since: row.since,
    pending: row.pending,
    pendingCount: row.pending_count,
    nextDueAt: row.next_due_at,
    lastCheckedAt: row.last_checked_at,
    lastHealth: row.last_health,
    lastDetail: row.last_detail,
    lastLatencyMs: row.last_latency_ms,
    lastScore: row.last_score,
    lastChecks: row.last_checks_json
      ? (JSON.parse(row.last_checks_json) as CheckResult[])
      : null,
  };
}

export function readStates(db: Database): Map<string, StateRow> {
  return new Map(
    db
      .query<StateRecord, []>("SELECT * FROM service_state")
      .all()
      .map((row) => [row.service_id, toState(row)]),
  );
}

export function readState(db: Database, serviceId: string): StateRow | null {
  const row = db
    .query<StateRecord, [string]>(
      "SELECT * FROM service_state WHERE service_id = ?",
    )
    .get(serviceId);
  return row ? toState(row) : null;
}

export function writeState(db: Database, state: StateRow): void {
  db.query(
    `INSERT OR REPLACE INTO service_state
      (service_id, health, since, pending, pending_count, next_due_at,
       last_checked_at, last_health, last_detail, last_latency_ms, last_score,
       last_checks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    state.serviceId,
    state.health,
    state.since,
    state.pending,
    state.pendingCount,
    state.nextDueAt,
    state.lastCheckedAt,
    state.lastHealth,
    state.lastDetail,
    state.lastLatencyMs,
    state.lastScore,
    state.lastChecks ? JSON.stringify(state.lastChecks) : null,
  );
}

/** Reschedules a service without recording a result, e.g. after a pause. */
export function setNextDue(db: Database, serviceId: string, at: number): void {
  db.query("UPDATE service_state SET next_due_at = ? WHERE service_id = ?").run(
    at,
    serviceId,
  );
}

export type CheckTransition = {
  serviceId: string;
  checkId: string;
  label: string;
  time: number;
  ok: boolean;
  detail: string | null;
};

/**
 * Records checks whose result changed since the previous probe.
 *
 * Only changes are stored, which keeps a "what changed" history cheap no
 * matter how often a service is probed. On the first probe only failing
 * checks are recorded, since a passing check is the unremarkable default.
 */
export function recordCheckTransitions(
  db: Database,
  serviceId: string,
  time: number,
  previous: readonly CheckResult[] | null,
  next: readonly CheckResult[] | null,
): CheckTransition[] {
  if (!next) return [];
  const before = new Map((previous ?? []).map((check) => [check.id, check.ok]));
  const changes: CheckTransition[] = [];
  for (const check of next) {
    const prior = before.get(check.id);
    const changed = prior === undefined ? !check.ok : prior !== check.ok;
    if (!changed) continue;
    changes.push({
      serviceId,
      checkId: check.id,
      label: check.label,
      time,
      ok: check.ok,
      detail: check.detail ?? null,
    });
  }
  const insert = db.query(
    `INSERT OR REPLACE INTO check_transitions
      (service_id, check_id, time, label, ok, detail) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const change of changes)
    insert.run(
      change.serviceId,
      change.checkId,
      change.time,
      change.label,
      change.ok ? 1 : 0,
      change.detail,
    );
  return changes;
}

export function readCheckTransitions(
  db: Database,
  serviceId: string,
  from: number,
  limit = 100,
): CheckTransition[] {
  return db
    .query<
      {
        check_id: string;
        label: string;
        time: number;
        ok: number;
        detail: string | null;
      },
      [string, number, number]
    >(
      `SELECT check_id, label, time, ok, detail FROM check_transitions
       WHERE service_id = ? AND time >= ? ORDER BY time DESC LIMIT ?`,
    )
    .all(serviceId, from, limit)
    .map((row) => ({
      serviceId,
      checkId: row.check_id,
      label: row.label,
      time: row.time,
      ok: row.ok === 1,
      detail: row.detail,
    }));
}

/** Deletes data older than the configured retention. */
export function prune(
  db: Database,
  now: number,
  retention: { rawDays: number; rollupDays: number },
): void {
  const raw = now - retention.rawDays * DAY_MS;
  const daily = now - retention.rollupDays * DAY_MS;
  db.transaction(() => {
    db.query("DELETE FROM samples WHERE time < ?").run(raw);
    db.query(
      "DELETE FROM rollups WHERE granularity = 'hour' AND bucket < ?",
    ).run(now - HOUR_ROLLUP_RETENTION_MS);
    db.query(
      "DELETE FROM rollups WHERE granularity = 'day' AND bucket < ?",
    ).run(daily);
    db.query("DELETE FROM check_transitions WHERE time < ?").run(daily);
    db.query(
      "DELETE FROM incident_events WHERE incident_id IN (SELECT id FROM incidents WHERE status = 'resolved' AND resolved_at < ?)",
    ).run(daily);
    db.query(
      "DELETE FROM incidents WHERE status = 'resolved' AND resolved_at < ?",
    ).run(daily);
    db.query("DELETE FROM suppressions WHERE ends_at < ?").run(daily);
  })();
}
