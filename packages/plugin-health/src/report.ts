import type { Database } from "bun:sqlite";
import type { ServiceSummary } from "./context.js";
import { CONTRACT_VERSION, type Period, type Report } from "./contract.js";
import { listOutages, meanTimeToRecover, type Outage } from "./outages.js";
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
  outages: readonly Outage[],
  granularity: Granularity,
  from: number,
  to: number,
): Period {
  const started = outages.filter(
    (outage) => outage.startedAt >= from && outage.startedAt < to,
  );
  const ended = outages.filter(
    (outage) =>
      outage.endedAt !== null && outage.endedAt >= from && outage.endedAt < to,
  );
  const durations = ended.map(
    (outage) => (outage.endedAt ?? 0) - outage.startedAt,
  );
  return {
    from,
    to,
    availability: fleetAvailability(db, services, granularity, from, to),
    outagesStarted: started.length,
    outagesEnded: ended.length,
    meanTimeToRecoverMs: meanTimeToRecover(ended),
    longestOutageMs: durations.length > 0 ? Math.max(...durations) : null,
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
  const outages = listOutages(db, {
    serviceIds: services.map((service) => service.id),
    since: now - 2 * span,
    limit: 5_000,
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
      outages: outages.filter(
        (outage) =>
          outage.serviceId === service.id && outage.startedAt >= now - span,
      ).length,
    }))
    // Worst first; services with no data last, since they say nothing.
    .sort(
      (a, b) =>
        (a.availability ?? Number.POSITIVE_INFINITY) -
          (b.availability ?? Number.POSITIVE_INFINITY) ||
        b.outages - a.outages ||
        a.name.localeCompare(b.name),
    );
  return {
    version: CONTRACT_VERSION,
    generatedAt: now,
    days,
    current: periodOf(db, services, outages, granularity, now - span, now + 1),
    previous: periodOf(
      db,
      services,
      outages,
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
    `${current.outagesStarted} ${current.outagesStarted === 1 ? "outage" : "outages"}`,
  ];
  if (current.meanTimeToRecoverMs !== null)
    parts.push(`mean time to recover ${minutes(current.meanTimeToRecoverMs)}`);
  if (worst && (worst.availability ?? 100) < 100)
    parts.push(`lowest: ${worst.name} at ${pct(worst.availability)}`);
  return parts.join(", ");
}
