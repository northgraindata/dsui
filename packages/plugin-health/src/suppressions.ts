import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

/**
 * - `maintenance`: planned work. Suppresses incidents and signals, and the
 *   time is excluded from uptime so it does not count against an SLO.
 * - `silence`: suppresses incidents and signals only. The outage still
 *   happened, so it still counts as downtime.
 */
export type SuppressionKind = "maintenance" | "silence";

export type Suppression = {
  id: string;
  kind: SuppressionKind;
  /** `null` applies to every service. */
  serviceId: string | null;
  startsAt: number;
  endsAt: number;
  reason: string | null;
  createdBy: string | null;
  createdAt: number;
};

type Record = {
  id: string;
  kind: SuppressionKind;
  service_id: string | null;
  starts_at: number;
  ends_at: number;
  reason: string | null;
  created_by: string | null;
  created_at: number;
};

const toSuppression = (row: Record): Suppression => ({
  id: row.id,
  kind: row.kind,
  serviceId: row.service_id,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  reason: row.reason,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export function createSuppression(
  db: Database,
  input: {
    kind: SuppressionKind;
    serviceId: string | null;
    startsAt: number;
    endsAt: number;
    reason?: string;
    createdBy: string;
  },
  now: number,
): Suppression {
  if (!(input.endsAt > input.startsAt))
    throw new Error("A suppression must end after it starts");
  const suppression: Suppression = {
    id: randomUUID(),
    kind: input.kind,
    serviceId: input.serviceId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    reason: input.reason ?? null,
    createdBy: input.createdBy,
    createdAt: now,
  };
  db.query(
    `INSERT INTO suppressions (id, kind, service_id, starts_at, ends_at, reason, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    suppression.id,
    suppression.kind,
    suppression.serviceId,
    suppression.startsAt,
    suppression.endsAt,
    suppression.reason,
    suppression.createdBy,
    suppression.createdAt,
  );
  return suppression;
}

export function deleteSuppression(db: Database, id: string): boolean {
  return db.query("DELETE FROM suppressions WHERE id = ?").run(id).changes > 0;
}

/** Suppressions that are active, or start before `until`, newest first. */
export function listSuppressions(
  db: Database,
  options: { now: number; includePast?: boolean },
): Suppression[] {
  const rows = options.includePast
    ? db
        .query<Record, []>(
          "SELECT * FROM suppressions ORDER BY starts_at DESC LIMIT 200",
        )
        .all()
    : db
        .query<Record, [number]>(
          "SELECT * FROM suppressions WHERE ends_at >= ? ORDER BY starts_at",
        )
        .all(options.now);
  return rows.map(toSuppression);
}

export type Suppressed = { maintenance: boolean; silenced: boolean };

/** Which suppressions cover a service at `time`. */
export function suppressionAt(
  db: Database,
  serviceId: string,
  time: number,
): Suppressed {
  const rows = db
    .query<{ kind: SuppressionKind }, [string, number, number]>(
      `SELECT kind FROM suppressions
       WHERE (service_id IS NULL OR service_id = ?) AND starts_at <= ? AND ends_at > ?`,
    )
    .all(serviceId, time, time);
  const maintenance = rows.some((row) => row.kind === "maintenance");
  return {
    maintenance,
    silenced: maintenance || rows.some((row) => row.kind === "silence"),
  };
}
