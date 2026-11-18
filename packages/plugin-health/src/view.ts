import type { Database } from "bun:sqlite";
import type { PluginServiceCatalog } from "@northgraindata/dsui-plugin-sdk";
import type { HealthConfig } from "./config.js";
import { countHealth, type Health, type ServiceSummary } from "./context.js";
import {
  CONTRACT_VERSION,
  type Fleet,
  type FleetItem,
  type OutageView,
  type ServiceDetail,
  type StripBucket,
  type StripStatus,
  type SuppressionList,
  type SuppressionView,
} from "./contract.js";
import { activeOutage, listOutages, type Outage } from "./outages.js";
import {
  readCheckTransitions,
  readRollups,
  readState,
  readStates,
  type StateRow,
} from "./repo.js";
import {
  availabilityOf,
  DAY_MS,
  type Granularity,
  HOUR_MS,
  mergeRollups,
  percentile,
  type Rollup,
} from "./rollups.js";
import {
  errorBudget,
  RANGES,
  rangeRollup,
  rangeStats,
  readSlo,
} from "./slo.js";
import {
  listSuppressions,
  type Suppression,
  suppressionAt,
} from "./suppressions.js";

export const STRIP_HOURS = 168;
export const STRIP_DAYS = 90;

/** Every service the requester can see, up to `max`. */
export async function listServices(
  catalog: Pick<PluginServiceCatalog, "list">,
  max: number,
): Promise<ServiceSummary[]> {
  const services: ServiceSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await catalog.list({
      limit: Math.min(100, max - services.length),
      ...(cursor ? { cursor } : {}),
    });
    for (const item of page.items) {
      services.push({
        id: item.id,
        name: item.name,
        adapter: item.adapter,
        managedBy: item.managedBy,
        ...(item.iconUrl ? { iconUrl: item.iconUrl } : {}),
      });
    }
    cursor = page.nextCursor;
  } while (cursor && services.length < max);
  return services;
}

/** The worst status in a bucket; maintenance only when nothing else was seen. */
export function worstStatus(rollup: Rollup): StripStatus | null {
  if (rollup.unavailable > 0) return "unavailable";
  if (rollup.warning > 0) return "warning";
  if (rollup.healthy > 0) return "healthy";
  if (rollup.unknown > 0) return "unknown";
  if (rollup.maintenance > 0) return "maintenance";
  return null;
}

const samplesIn = (rollup: Rollup) =>
  rollup.healthy +
  rollup.warning +
  rollup.unavailable +
  rollup.unknown +
  rollup.maintenance;

/** A fixed number of buckets ending at the current one, gaps included. */
export function buildStrip(
  rollups: ReadonlyMap<number, Rollup>,
  now: number,
  granularity: Granularity,
  count: number,
): StripBucket[] {
  const size = granularity === "hour" ? HOUR_MS : DAY_MS;
  const end = Math.floor(now / size) * size;
  return Array.from({ length: count }, (_, index) => {
    const time = end - (count - 1 - index) * size;
    const rollup = rollups.get(time);
    return {
      time,
      health: rollup ? worstStatus(rollup) : null,
      samples: rollup ? samplesIn(rollup) : 0,
      latencyMs:
        rollup && rollup.latencyCount > 0
          ? rollup.latencySum / rollup.latencyCount
          : null,
    };
  });
}

function outageView(
  outage: Outage,
  services: ReadonlyMap<string, ServiceSummary>,
): OutageView {
  const service = services.get(outage.serviceId);
  return {
    ...outage,
    serviceName: service?.name ?? outage.serviceId,
    adapter: service?.adapter ?? "",
  };
}

function suppressionView(
  suppression: Suppression,
  services: ReadonlyMap<string, ServiceSummary>,
): SuppressionView {
  return {
    ...suppression,
    serviceName: suppression.serviceId
      ? (services.get(suppression.serviceId)?.name ?? suppression.serviceId)
      : null,
  };
}

function itemFor(
  db: Database,
  service: ServiceSummary,
  state: StateRow | undefined,
  now: number,
): FleetItem {
  const rollups = readRollups(
    db,
    service.id,
    "hour",
    now - STRIP_HOURS * HOUR_MS,
    now,
  );
  const availability = availabilityOf(mergeRollups([...rollups.values()]));
  const outage = activeOutage(db, service.id);
  return {
    ...service,
    health: state?.health ?? "unknown",
    since: state?.since ?? null,
    lastCheckedAt: state?.lastCheckedAt ?? null,
    nextCheckAt: state?.nextDueAt ?? null,
    ...(state?.lastDetail ? { detail: state.lastDetail } : {}),
    ...(state?.lastLatencyMs != null ? { latencyMs: state.lastLatencyMs } : {}),
    ...(state?.lastScore != null ? { score: state.lastScore } : {}),
    availability7d: availability.availability,
    strip: buildStrip(rollups, now, "hour", STRIP_HOURS),
    outageId: outage?.id ?? null,
    maintenance: suppressionAt(db, service.id, now).maintenance,
  };
}

/** Health of every given service, read from storage. Never probes. */
export function buildFleet(
  db: Database,
  services: readonly ServiceSummary[],
  now: number,
): Fleet {
  const states = readStates(db);
  const items = services.map((service) =>
    itemFor(db, service, states.get(service.id), now),
  );
  const counts = countHealth(
    items.map((item) => ({ ...item, health: item.health as Health })),
  );
  const fleetRollup = mergeRollups(
    services.map((service) =>
      mergeRollups([
        ...readRollups(db, service.id, "hour", now - 7 * DAY_MS, now).values(),
      ]),
    ),
  );
  return {
    version: CONTRACT_VERSION,
    generatedAt: now,
    items,
    counts,
    activeOutages: listOutages(db, {
      serviceIds: services.map((service) => service.id),
      activeOnly: true,
    }).length,
    availability7d: availabilityOf(fleetRollup).availability,
  };
}

export function buildServiceDetail(
  db: Database,
  config: HealthConfig,
  service: ServiceSummary,
  services: ReadonlyMap<string, ServiceSummary>,
  now: number,
): ServiceDetail {
  const state = readState(db, service.id);
  const suppression = suppressionAt(db, service.id, now);
  const hourly = readRollups(
    db,
    service.id,
    "hour",
    now - STRIP_HOURS * HOUR_MS,
    now,
  );
  const daily = readRollups(
    db,
    service.id,
    "day",
    now - STRIP_DAYS * DAY_MS,
    now,
  );
  const slo = readSlo(db, config, service.id);
  return {
    version: CONTRACT_VERSION,
    generatedAt: now,
    service,
    state: state
      ? {
          health: state.health,
          since: state.since,
          lastCheckedAt: state.lastCheckedAt,
          nextCheckAt: state.nextDueAt,
          ...(state.lastDetail ? { detail: state.lastDetail } : {}),
          ...(state.lastLatencyMs != null
            ? { latencyMs: state.lastLatencyMs }
            : {}),
          ...(state.lastScore != null ? { score: state.lastScore } : {}),
          checks: (state.lastChecks ?? []).map((check) => ({ ...check })),
          maintenance: suppression.maintenance,
          silenced: suppression.silenced,
        }
      : null,
    ranges: RANGES.map((days) => rangeStats(db, service.id, days, now)),
    slo: slo
      ? {
          source: slo.source,
          budget: errorBudget(
            rangeRollup(db, service.id, slo.windowDays, now),
            slo,
          ),
        }
      : null,
    strip: buildStrip(hourly, now, "hour", STRIP_HOURS),
    daily: buildStrip(daily, now, "day", STRIP_DAYS).map((bucket) => {
      const rollup = daily.get(bucket.time);
      return {
        ...bucket,
        availability: rollup ? availabilityOf(rollup).availability : null,
      };
    }),
    latency: buildStrip(hourly, now, "hour", STRIP_HOURS).map((bucket) => {
      const rollup = hourly.get(bucket.time);
      return {
        time: bucket.time,
        average: bucket.latencyMs,
        p95: rollup ? percentile(rollup, 0.95) : null,
      };
    }),
    transitions: readCheckTransitions(
      db,
      service.id,
      now - 30 * DAY_MS,
      50,
    ).map(({ serviceId: _serviceId, ...transition }) => transition),
    outages: listOutages(db, {
      serviceIds: [service.id],
      since: now - STRIP_DAYS * DAY_MS,
      limit: 20,
    }).map((outage) => outageView(outage, services)),
    suppressions: listSuppressions(db, { now })
      .filter(
        (item) => item.serviceId === null || item.serviceId === service.id,
      )
      .map((item) => suppressionView(item, services)),
  };
}

export function buildSuppressionList(
  db: Database,
  services: ReadonlyMap<string, ServiceSummary>,
  now: number,
): SuppressionList {
  return {
    version: CONTRACT_VERSION,
    generatedAt: now,
    items: listSuppressions(db, { now })
      .filter((item) => item.serviceId === null || services.has(item.serviceId))
      .map((item) => suppressionView(item, services)),
  };
}
