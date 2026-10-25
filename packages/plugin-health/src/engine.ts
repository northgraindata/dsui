import type { Database } from "bun:sqlite";
import { type HealthConfig, intervalFor } from "./config.js";
import type { Health, Probe, ServiceSummary } from "./context.js";
import { isWorkspacePath } from "./href.js";
import { type IncidentEffect, reconcileIncident } from "./incidents.js";
import {
  type CheckResult,
  readState,
  recordCheckTransitions,
  recordSample,
  type StateRow,
  writeState,
} from "./repo.js";
import { nextDueAt } from "./scheduler.js";
import { type SignalEmission, signalFor } from "./signals.js";
import { advance } from "./state.js";
import { suppressionAt } from "./suppressions.js";

const optional = <K extends string, V>(key: K, value: V | undefined) =>
  value === undefined ? {} : ({ [key]: value } as { [P in K]: V });

export type RecordOutcome = {
  state: StateRow;
  changed: boolean;
  effect: IncidentEffect | null;
  signal: SignalEmission | null;
};

/** Short headline for an incident: which checks are failing. */
function headline(
  probe: Probe | null,
  failing: readonly CheckResult[],
): string {
  if (failing.length > 0)
    return `${failing.map((check) => check.label).join(", ")} failing`;
  return probe?.detail ?? "Service is not healthy";
}

/** What the adapter said about the failure, for the incident timeline. */
function explanation(
  probe: Probe | null,
  failing: readonly CheckResult[],
): string | undefined {
  const details = failing.flatMap((check) =>
    check.detail ? [`${check.label}: ${check.detail}`] : [],
  );
  return details.length > 0 ? details.join("; ") : probe?.detail;
}

/**
 * Records one probe result and everything that follows from it.
 *
 * In one transaction: the sample and its rollups, check changes, the debounced
 * state, and the incident. Returns the signal to emit rather than emitting it,
 * so storage stays synchronous and the caller decides when events go out,
 * after the data they describe is committed.
 */
export function recordProbeResult(
  db: Database,
  config: HealthConfig,
  service: ServiceSummary,
  probe: Probe | null,
  now: number,
): RecordOutcome {
  return db.transaction(() => {
    const observed: Health = probe?.health ?? "unknown";
    const checks: CheckResult[] | null = probe?.checks
      ? probe.checks.map((check) => ({
          id: check.id,
          label: check.label,
          ok: check.ok,
          ...(check.detail !== undefined ? { detail: check.detail } : {}),
          ...(isWorkspacePath(check.href) ? { href: check.href } : {}),
        }))
      : null;
    const failing = (checks ?? []).filter((check) => !check.ok);
    const suppression = suppressionAt(db, service.id, now);
    const previous = readState(db, service.id);

    recordSample(db, {
      serviceId: service.id,
      time: now,
      health: observed,
      latencyMs: probe?.latencyMs ?? null,
      score: probe?.score ?? null,
      detail: probe?.detail ?? null,
      checks,
      maintenance: suppression.maintenance,
    });
    recordCheckTransitions(
      db,
      service.id,
      now,
      previous?.lastChecks ?? null,
      checks,
    );

    const moved = advance(previous, observed, now, config);
    const effect = reconcileIncident(db, {
      serviceId: service.id,
      health: moved.next.health,
      summary: headline(probe, failing),
      ...optional("detail", explanation(probe, failing)),
      now,
      suppressed: suppression.silenced,
      reopenWindowMs: config.reopenWindowMinutes * 60_000,
      failingChecks: failing.map((check) => check.id),
    });

    const state: StateRow = {
      ...moved.next,
      serviceId: service.id,
      nextDueAt: nextDueAt(service.id, now, intervalFor(config, service.id)),
      lastCheckedAt: now,
      lastHealth: observed,
      lastDetail: probe?.detail ?? null,
      lastLatencyMs: probe?.latencyMs ?? null,
      lastScore: probe?.score ?? null,
      // An unknown result says nothing about individual checks, so the last
      // real reading stays the basis for detecting the next change.
      lastChecks: checks ?? previous?.lastChecks ?? null,
    };
    writeState(db, state);

    const signal = suppression.silenced
      ? null
      : signalFor(effect, {
          serviceId: service.id,
          serviceName: service.name,
          previous: moved.from,
          current: moved.next.health,
          since: moved.next.since,
          failingChecks: failing.map((check) => ({
            id: check.id,
            label: check.label,
            ...(check.detail !== undefined ? { detail: check.detail } : {}),
          })),
          ...(probe?.latencyMs !== undefined
            ? { latencyMs: probe.latencyMs }
            : {}),
        });
    return { state, changed: moved.changed, effect, signal };
  })();
}
