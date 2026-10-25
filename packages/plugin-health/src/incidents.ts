import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import type { Health } from "./context.js";

export type Severity = "warning" | "unavailable";
export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IncidentEventKind =
  | "opened"
  | "escalated"
  | "deescalated"
  | "acknowledged"
  | "note"
  | "resolved"
  | "reopened";

export type Incident = {
  id: string;
  serviceId: string;
  status: IncidentStatus;
  severity: Severity;
  peakSeverity: Severity;
  summary: string;
  openedAt: number;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  resolvedAt: number | null;
  /** `null` with a resolved status means DSUI resolved it on recovery. */
  resolvedBy: string | null;
  resolutionNote: string | null;
};

export type IncidentEvent = {
  id: number;
  incidentId: string;
  time: number;
  kind: IncidentEventKind;
  actor: string | null;
  message: string | null;
  detail: unknown;
};

type IncidentRecord = {
  id: string;
  service_id: string;
  status: IncidentStatus;
  severity: Severity;
  peak_severity: Severity;
  summary: string;
  opened_at: number;
  acknowledged_at: number | null;
  acknowledged_by: string | null;
  resolved_at: number | null;
  resolved_by: string | null;
  resolution_note: string | null;
};

function toIncident(row: IncidentRecord): Incident {
  return {
    id: row.id,
    serviceId: row.service_id,
    status: row.status,
    severity: row.severity,
    peakSeverity: row.peak_severity,
    summary: row.summary,
    openedAt: row.opened_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
  };
}

export function severityOf(health: Health): Severity | null {
  return health === "warning" || health === "unavailable" ? health : null;
}

const rank: Record<Severity, number> = { warning: 0, unavailable: 1 };

// An operator who resolves an incident by hand while the service is still
// failing does not want a new one on the next probe. The dismissal lasts
// until the service is seen healthy again.
const dismissalKey = (serviceId: string) => `dismissed:${serviceId}`;

function isDismissed(db: Database, serviceId: string): boolean {
  return (
    db
      .query<{ value: string }, [string]>(
        "SELECT value FROM meta WHERE key = ?",
      )
      .get(dismissalKey(serviceId)) !== null
  );
}

function clearDismissal(db: Database, serviceId: string): void {
  db.query("DELETE FROM meta WHERE key = ?").run(dismissalKey(serviceId));
}

export function addEvent(
  db: Database,
  incidentId: string,
  time: number,
  kind: IncidentEventKind,
  options: { actor?: string | null; message?: string; detail?: unknown } = {},
): void {
  db.query(
    `INSERT INTO incident_events (incident_id, time, kind, actor, message, detail_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    incidentId,
    time,
    kind,
    options.actor ?? null,
    options.message ?? null,
    options.detail === undefined ? null : JSON.stringify(options.detail),
  );
}

export function getIncident(db: Database, id: string): Incident | null {
  const row = db
    .query<IncidentRecord, [string]>("SELECT * FROM incidents WHERE id = ?")
    .get(id);
  return row ? toIncident(row) : null;
}

/** The unresolved incident for a service, if any. */
export function activeIncident(
  db: Database,
  serviceId: string,
): Incident | null {
  const row = db
    .query<IncidentRecord, [string]>(
      "SELECT * FROM incidents WHERE service_id = ? AND status != 'resolved' ORDER BY opened_at DESC LIMIT 1",
    )
    .get(serviceId);
  return row ? toIncident(row) : null;
}

function lastAutoResolved(
  db: Database,
  serviceId: string,
  since: number,
): Incident | null {
  const row = db
    .query<IncidentRecord, [string, number]>(
      `SELECT * FROM incidents
       WHERE service_id = ? AND status = 'resolved' AND resolved_by IS NULL AND resolved_at >= ?
       ORDER BY resolved_at DESC LIMIT 1`,
    )
    .get(serviceId, since);
  return row ? toIncident(row) : null;
}

export type IncidentEffect =
  | { kind: "opened"; incident: Incident }
  | { kind: "reopened"; incident: Incident }
  | { kind: "escalated"; incident: Incident; from: Severity }
  | { kind: "deescalated"; incident: Incident; from: Severity }
  | { kind: "resolved"; incident: Incident };

/**
 * Brings a service's incident in line with its accepted health.
 *
 * Run after every probe rather than only on a state change, so an incident is
 * still opened when a maintenance window ends while the service is down, and
 * a service that recovered during one is not left with a stale incident.
 *
 * A service that fails again shortly after DSUI auto-resolved its incident
 * reopens that incident instead of starting a new one, so a flapping service
 * reads as one ongoing problem rather than a stream of short ones.
 */
export function reconcileIncident(
  db: Database,
  input: {
    serviceId: string;
    health: Health;
    /** Short headline, e.g. the failing check names. */
    summary: string;
    /** Longer explanation for the timeline, e.g. the adapter's error text. */
    detail?: string;
    now: number;
    suppressed: boolean;
    reopenWindowMs: number;
    failingChecks: readonly string[];
  },
): IncidentEffect | null {
  const severity = severityOf(input.health);
  const current = activeIncident(db, input.serviceId);
  if (input.health === "healthy") clearDismissal(db, input.serviceId);

  if (severity === null) {
    if (!current || input.health === "unknown") return null;
    db.query(
      "UPDATE incidents SET status = 'resolved', resolved_at = ?, resolved_by = NULL WHERE id = ?",
    ).run(input.now, current.id);
    addEvent(db, current.id, input.now, "resolved", {
      message: "Service recovered",
    });
    return {
      kind: "resolved",
      incident: { ...current, status: "resolved", resolvedAt: input.now },
    };
  }

  if (current) {
    if (current.severity === severity) return null;
    const peak =
      rank[severity] > rank[current.peakSeverity]
        ? severity
        : current.peakSeverity;
    db.query(
      "UPDATE incidents SET severity = ?, peak_severity = ?, summary = ? WHERE id = ?",
    ).run(severity, peak, input.summary, current.id);
    const escalated = rank[severity] > rank[current.severity];
    addEvent(
      db,
      current.id,
      input.now,
      escalated ? "escalated" : "deescalated",
      {
        message: input.summary,
        detail: { from: current.severity, to: severity },
      },
    );
    return {
      kind: escalated ? "escalated" : "deescalated",
      incident: {
        ...current,
        severity,
        peakSeverity: peak,
        summary: input.summary,
      },
      from: current.severity,
    } as IncidentEffect;
  }

  if (input.suppressed || isDismissed(db, input.serviceId)) return null;

  const recent = lastAutoResolved(
    db,
    input.serviceId,
    input.now - input.reopenWindowMs,
  );
  if (recent) {
    const peak =
      rank[severity] > rank[recent.peakSeverity]
        ? severity
        : recent.peakSeverity;
    db.query(
      `UPDATE incidents SET status = 'open', severity = ?, peak_severity = ?, summary = ?,
         resolved_at = NULL, resolved_by = NULL, resolution_note = NULL,
         acknowledged_at = NULL, acknowledged_by = NULL
       WHERE id = ?`,
    ).run(severity, peak, input.summary, recent.id);
    addEvent(db, recent.id, input.now, "reopened", {
      message: input.detail ?? input.summary,
      detail: { checks: input.failingChecks },
    });
    return {
      kind: "reopened",
      incident: {
        ...recent,
        status: "open",
        severity,
        peakSeverity: peak,
        summary: input.summary,
        resolvedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    };
  }

  const incident: Incident = {
    id: randomUUID(),
    serviceId: input.serviceId,
    status: "open",
    severity,
    peakSeverity: severity,
    summary: input.summary,
    openedAt: input.now,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
  };
  db.query(
    `INSERT INTO incidents (id, service_id, status, severity, peak_severity, summary, opened_at)
     VALUES (?, ?, 'open', ?, ?, ?, ?)`,
  ).run(
    incident.id,
    incident.serviceId,
    severity,
    severity,
    input.summary,
    input.now,
  );
  addEvent(db, incident.id, input.now, "opened", {
    message: input.detail ?? input.summary,
    detail: { checks: input.failingChecks },
  });
  return { kind: "opened", incident };
}

export type IncidentFilter = {
  serviceIds: readonly string[];
  status?: "active" | "resolved" | "all";
  serviceId?: string;
  limit?: number;
};

/** Incidents for the given services, newest first. */
export function listIncidents(
  db: Database,
  filter: IncidentFilter,
): Incident[] {
  if (filter.serviceIds.length === 0) return [];
  const where = [
    `service_id IN (${filter.serviceIds.map(() => "?").join(",")})`,
  ];
  const params: (string | number)[] = [...filter.serviceIds];
  if (filter.serviceId) {
    where.push("service_id = ?");
    params.push(filter.serviceId);
  }
  if (filter.status === "active") where.push("status != 'resolved'");
  if (filter.status === "resolved") where.push("status = 'resolved'");
  params.push(filter.limit ?? 100);
  return db
    .query<IncidentRecord, (string | number)[]>(
      `SELECT * FROM incidents WHERE ${where.join(" AND ")} ORDER BY opened_at DESC LIMIT ?`,
    )
    .all(...params)
    .map(toIncident);
}

export function listEvents(db: Database, incidentId: string): IncidentEvent[] {
  return db
    .query<
      {
        id: number;
        incident_id: string;
        time: number;
        kind: IncidentEventKind;
        actor: string | null;
        message: string | null;
        detail_json: string | null;
      },
      [string]
    >("SELECT * FROM incident_events WHERE incident_id = ? ORDER BY time, id")
    .all(incidentId)
    .map((row) => ({
      id: row.id,
      incidentId: row.incident_id,
      time: row.time,
      kind: row.kind,
      actor: row.actor,
      message: row.message,
      detail: row.detail_json ? JSON.parse(row.detail_json) : null,
    }));
}

export type ActionResult =
  | { ok: true; incident: Incident }
  | {
      ok: false;
      reason: "not-found" | "already-resolved" | "already-acknowledged";
    };

export function acknowledgeIncident(
  db: Database,
  id: string,
  actor: string,
  now: number,
): ActionResult {
  const incident = getIncident(db, id);
  if (!incident) return { ok: false, reason: "not-found" };
  if (incident.status === "resolved")
    return { ok: false, reason: "already-resolved" };
  if (incident.status === "acknowledged")
    return { ok: false, reason: "already-acknowledged" };
  db.query(
    "UPDATE incidents SET status = 'acknowledged', acknowledged_at = ?, acknowledged_by = ? WHERE id = ?",
  ).run(now, actor, id);
  addEvent(db, id, now, "acknowledged", { actor });
  return {
    ok: true,
    incident: {
      ...incident,
      status: "acknowledged",
      acknowledgedAt: now,
      acknowledgedBy: actor,
    },
  };
}

export function noteIncident(
  db: Database,
  id: string,
  actor: string,
  message: string,
  now: number,
): ActionResult {
  const incident = getIncident(db, id);
  if (!incident) return { ok: false, reason: "not-found" };
  addEvent(db, id, now, "note", { actor, message });
  return { ok: true, incident };
}

/**
 * Resolves an incident by hand.
 *
 * The service may still be unhealthy. A manual resolution closes the record
 * and holds off a new incident until the service has been seen healthy, so
 * closing one does not just trigger another on the next probe.
 */
export function resolveIncident(
  db: Database,
  id: string,
  actor: string,
  note: string | undefined,
  now: number,
): ActionResult {
  const incident = getIncident(db, id);
  if (!incident) return { ok: false, reason: "not-found" };
  if (incident.status === "resolved")
    return { ok: false, reason: "already-resolved" };
  db.query(
    "UPDATE incidents SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution_note = ? WHERE id = ?",
  ).run(now, actor, note ?? null, id);
  db.query("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(
    dismissalKey(incident.serviceId),
    String(now),
  );
  addEvent(db, id, now, "resolved", {
    actor,
    ...(note ? { message: note } : {}),
  });
  return {
    ok: true,
    incident: {
      ...incident,
      status: "resolved",
      resolvedAt: now,
      resolvedBy: actor,
      resolutionNote: note ?? null,
    },
  };
}

/** Mean time to resolve, over resolved incidents, in milliseconds. */
export function meanTimeToResolve(
  incidents: readonly Incident[],
): number | null {
  const durations = incidents
    .filter((incident) => incident.resolvedAt !== null)
    .map((incident) => (incident.resolvedAt ?? 0) - incident.openedAt);
  if (durations.length === 0) return null;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}
