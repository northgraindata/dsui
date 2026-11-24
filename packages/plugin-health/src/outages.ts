import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import type { Health } from "./context.js";

export type Severity = "warning" | "unavailable";

/**
 * A period in which a service was not healthy, recorded automatically.
 *
 * An outage is a fact about a service, not a piece of work: nobody
 * acknowledges or resolves it, it ends when the service recovers. Handling a
 * problem (owners, severity, notes, postmortems) belongs to an incident
 * plugin, which groups outages through the `stateKey` of the signals that
 * announce them.
 */
export type Outage = {
  id: string;
  serviceId: string;
  severity: Severity;
  peakSeverity: Severity;
  /** Short headline, e.g. the failing check names. */
  summary: string;
  /** What the adapter said about the failure, if anything. */
  detail: string | null;
  startedAt: number;
  /** `null` while the outage is ongoing. */
  endedAt: number | null;
};

type OutageRecord = {
  id: string;
  service_id: string;
  severity: Severity;
  peak_severity: Severity;
  summary: string;
  detail: string | null;
  started_at: number;
  ended_at: number | null;
};

function toOutage(row: OutageRecord): Outage {
  return {
    id: row.id,
    serviceId: row.service_id,
    severity: row.severity,
    peakSeverity: row.peak_severity,
    summary: row.summary,
    detail: row.detail,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export function severityOf(health: Health): Severity | null {
  return health === "warning" || health === "unavailable" ? health : null;
}

const rank: Record<Severity, number> = { warning: 0, unavailable: 1 };
const higher = (left: Severity, right: Severity) =>
  rank[left] >= rank[right] ? left : right;

export function getOutage(db: Database, id: string): Outage | null {
  const row = db
    .query<OutageRecord, [string]>("SELECT * FROM outages WHERE id = ?")
    .get(id);
  return row ? toOutage(row) : null;
}

/** The ongoing outage of a service, if any. */
export function activeOutage(db: Database, serviceId: string): Outage | null {
  const row = db
    .query<OutageRecord, [string]>(
      "SELECT * FROM outages WHERE service_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .get(serviceId);
  return row ? toOutage(row) : null;
}

function lastEnded(
  db: Database,
  serviceId: string,
  since: number,
): Outage | null {
  const row = db
    .query<OutageRecord, [string, number]>(
      `SELECT * FROM outages WHERE service_id = ? AND ended_at >= ?
       ORDER BY ended_at DESC LIMIT 1`,
    )
    .get(serviceId, since);
  return row ? toOutage(row) : null;
}

export type OutageEffect =
  | { kind: "started"; outage: Outage }
  | { kind: "reopened"; outage: Outage }
  | { kind: "escalated"; outage: Outage; from: Severity }
  | { kind: "deescalated"; outage: Outage; from: Severity }
  | { kind: "ended"; outage: Outage };

/**
 * Brings a service's outage in line with its accepted health.
 *
 * Run after every probe rather than only on a state change, so an outage
 * still starts when a maintenance window ends while the service is down.
 *
 * A service that fails again shortly after recovering continues the outage
 * that just ended instead of starting a new one, so a flapping service reads
 * as one ongoing problem and keeps one `stateKey`.
 */
export function reconcileOutage(
  db: Database,
  input: {
    serviceId: string;
    health: Health;
    summary: string;
    detail?: string;
    now: number;
    /** Maintenance or a silence: no new outage starts. */
    suppressed: boolean;
    reopenWindowMs: number;
  },
): OutageEffect | null {
  const severity = severityOf(input.health);
  const current = activeOutage(db, input.serviceId);

  if (severity === null) {
    // `unknown` says nothing either way, so an ongoing outage stays open.
    if (!current || input.health === "unknown") return null;
    db.query("UPDATE outages SET ended_at = ? WHERE id = ?").run(
      input.now,
      current.id,
    );
    return { kind: "ended", outage: { ...current, endedAt: input.now } };
  }

  if (current) {
    if (current.severity === severity) return null;
    const peak = higher(severity, current.peakSeverity);
    db.query(
      "UPDATE outages SET severity = ?, peak_severity = ?, summary = ?, detail = ? WHERE id = ?",
    ).run(severity, peak, input.summary, input.detail ?? null, current.id);
    const outage: Outage = {
      ...current,
      severity,
      peakSeverity: peak,
      summary: input.summary,
      detail: input.detail ?? null,
    };
    return rank[severity] > rank[current.severity]
      ? { kind: "escalated", outage, from: current.severity }
      : { kind: "deescalated", outage, from: current.severity };
  }

  if (input.suppressed) return null;

  const recent = lastEnded(
    db,
    input.serviceId,
    input.now - input.reopenWindowMs,
  );
  if (recent) {
    const peak = higher(severity, recent.peakSeverity);
    db.query(
      "UPDATE outages SET severity = ?, peak_severity = ?, summary = ?, detail = ?, ended_at = NULL WHERE id = ?",
    ).run(severity, peak, input.summary, input.detail ?? null, recent.id);
    return {
      kind: "reopened",
      outage: {
        ...recent,
        severity,
        peakSeverity: peak,
        summary: input.summary,
        detail: input.detail ?? null,
        endedAt: null,
      },
    };
  }

  const outage: Outage = {
    id: randomUUID(),
    serviceId: input.serviceId,
    severity,
    peakSeverity: severity,
    summary: input.summary,
    detail: input.detail ?? null,
    startedAt: input.now,
    endedAt: null,
  };
  db.query(
    `INSERT INTO outages (id, service_id, severity, peak_severity, summary, detail, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    outage.id,
    outage.serviceId,
    severity,
    severity,
    outage.summary,
    outage.detail,
    outage.startedAt,
  );
  return { kind: "started", outage };
}

export type OutageFilter = {
  serviceIds: readonly string[];
  /** Only outages that started or were still ongoing at or after this time. */
  since?: number;
  activeOnly?: boolean;
  limit?: number;
};

/** Outages of the given services, newest first. */
export function listOutages(db: Database, filter: OutageFilter): Outage[] {
  if (filter.serviceIds.length === 0) return [];
  const where = [
    `service_id IN (${filter.serviceIds.map(() => "?").join(",")})`,
  ];
  const params: (string | number)[] = [...filter.serviceIds];
  if (filter.activeOnly) where.push("ended_at IS NULL");
  if (filter.since !== undefined) {
    where.push("(ended_at IS NULL OR ended_at >= ?)");
    params.push(filter.since);
  }
  params.push(filter.limit ?? 100);
  return db
    .query<OutageRecord, (string | number)[]>(
      `SELECT * FROM outages WHERE ${where.join(" AND ")} ORDER BY started_at DESC LIMIT ?`,
    )
    .all(...params)
    .map(toOutage);
}

/** Mean time to recover over ended outages, in milliseconds. */
export function meanTimeToRecover(outages: readonly Outage[]): number | null {
  const durations = outages.flatMap((outage) =>
    outage.endedAt === null ? [] : [outage.endedAt - outage.startedAt],
  );
  if (durations.length === 0) return null;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}
