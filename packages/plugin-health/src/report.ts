import type { Database } from "bun:sqlite";
import type { ServiceSummary } from "./context.js";
import { CONTRACT_VERSION, type Period, type Report } from "./contract.js";
import {
  type Incident,
  listIncidents,
  meanTimeToResolve,
} from "./incidents.js";
import { readRollups } from "./repo.js";
import {
  availabilityOf,
  DAY_MS,
  type Granularity,
  mergeRollups,
} from "./rollups.js";

function availabilityBetween(
  db: Database,
  serviceId: string,
  granularity: Granularity,
  from: number,
  to: number,
): number | null {
  // `to` is exclusive: the next period starts in the bucket it ends in.
  const buckets = readRollups(db, serviceId, granularity, from, to - 1);
  return availabilityOf(mergeRollups([...buckets.values()])).availability;
}

function fleetAvailability(
  db: Database,
  services: readonly ServiceSummary[],
  granularity: Granularity,
  from: number,
  to: number,
): number | null {
  const merged = mergeRollups(
    services.map((service) =>
      mergeRollups([
        ...readRollups(db, service.id, granularity, from, to - 1).values(),
      ]),
    ),
  );
  return availabilityOf(merged).availability;
}

function periodOf(
  db: Database,
  services: readonly ServiceSummary[],
  incidents: readonly Incident[],
  granularity: Granularity,
  from: number,
  to: number,
): Period {
  const opened = incidents.filter(
    (incident) => incident.openedAt >= from && incident.openedAt < to,
  );
  const resolved = incidents.filter(
    (incident) =>
      incident.resolvedAt !== null &&
      incident.resolvedAt >= from &&
      incident.resolvedAt < to,
  );
  const durations = resolved.map(
    (incident) => (incident.resolvedAt ?? 0) - incident.openedAt,
  );
  return {
    from,
    to,
    availability: fleetAvailability(db, services, granularity, from, to),
    incidentsOpened: opened.length,
    incidentsResolved: resolved.length,
    meanTimeToResolveMs: meanTimeToResolve(resolved),
    longestIncidentMs: durations.length > 0 ? Math.max(...durations) : null,
  };
}

/**
 * Compares the last `days` with the `days` before them.
 *
 * Hourly rollups cover a week and daily rollups a month, so the same call
 * answers both without keeping raw samples.
 */
export function buildReport(
  db: Database,
  services: readonly ServiceSummary[],
  days: number,
  now: number,
): Report {
  const granularity: Granularity = days <= 7 ? "hour" : "day";
  const span = days * DAY_MS;
  const incidents = listIncidents(db, {
    serviceIds: services.map((service) => service.id),
    status: "all",
    limit: 1_000,
  });
  const rows = services
    .map((service) => ({
      id: service.id,
      name: service.name,
      adapter: service.adapter,
      availability: availabilityBetween(
        db,
        service.id,
        granularity,
        now - span,
        now + 1,
      ),
      previousAvailability: availabilityBetween(
        db,
        service.id,
        granularity,
        now - 2 * span,
        now - span,
      ),
      incidents: incidents.filter(
        (incident) =>
          incident.serviceId === service.id && incident.openedAt >= now - span,
      ).length,
    }))
    // Worst first; services with no data last, since they say nothing.
    .sort(
      (a, b) =>
        (a.availability ?? Number.POSITIVE_INFINITY) -
          (b.availability ?? Number.POSITIVE_INFINITY) ||
        b.incidents - a.incidents ||
        a.name.localeCompare(b.name),
    );
  return {
    version: CONTRACT_VERSION,
    generatedAt: now,
    days,
    current: periodOf(
      db,
      services,
      incidents,
      granularity,
      now - span,
      now + 1,
    ),
    previous: periodOf(
      db,
      services,
      incidents,
      granularity,
      now - 2 * span,
      now - span,
    ),
    services: rows,
  };
}

const pct = (value: number | null) =>
  value === null ? "no data" : `${value.toFixed(value >= 99.995 ? 3 : 2)}%`;

const minutes = (ms: number) =>
  ms >= 3_600_000
    ? `${(ms / 3_600_000).toFixed(1)}h`
    : `${Math.max(1, Math.round(ms / 60_000))}m`;

/** One readable paragraph for notifications that render a payload summary. */
export function summaryLine(report: Report): string {
  const { current, previous } = report;
  const worst = report.services.filter((s) => s.availability !== null)[0];
  const parts = [
    `Last ${report.days} days: ${pct(current.availability)} uptime (previous ${pct(previous.availability)})`,
    `${current.incidentsOpened} ${current.incidentsOpened === 1 ? "incident" : "incidents"}`,
  ];
  if (current.meanTimeToResolveMs !== null)
    parts.push(`mean time to resolve ${minutes(current.meanTimeToResolveMs)}`);
  if (worst && (worst.availability ?? 100) < 100)
    parts.push(`lowest: ${worst.name} at ${pct(worst.availability)}`);
  return parts.join(", ");
}
