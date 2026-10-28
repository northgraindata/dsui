import type { Probe, ServiceSummary } from "./context.js";

/**
 * Deterministic jitter in [-10%, +10%] of the interval.
 *
 * Derived from the service id rather than random so a service keeps its slot
 * across restarts, and a fleet that was all added at once still spreads out
 * instead of probing every adapter in the same second.
 */
export function jitterMs(serviceId: string, intervalMs: number): number {
  let hash = 2166136261;
  for (let index = 0; index < serviceId.length; index++) {
    hash ^= serviceId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unit = ((hash >>> 0) % 2001) / 1000 - 1;
  return Math.round(unit * intervalMs * 0.1);
}

/** When a service should next be probed, given it was checked at `now`. */
export function nextDueAt(
  serviceId: string,
  now: number,
  intervalMs: number,
): number {
  return now + intervalMs + jitterMs(serviceId, intervalMs);
}

/**
 * Services whose next probe time has passed, most overdue first.
 *
 * A service never seen before is due immediately, and sorts ahead of every
 * overdue one so a newly added service shows a status without waiting for
 * the rest of the queue.
 */
export function selectDue(
  services: readonly ServiceSummary[],
  dueAt: ReadonlyMap<string, number>,
  now: number,
): ServiceSummary[] {
  return services
    .map((service) => ({ service, due: dueAt.get(service.id) ?? -Infinity }))
    .filter((entry) => entry.due <= now)
    .sort((left, right) => left.due - right.due)
    .map((entry) => entry.service);
}

export type ProbeLimits = {
  /** Probes in flight across every adapter. */
  maxConcurrent: number;
  /** Probes in flight against one adapter. */
  maxPerAdapter: number;
};

export type ProbeOutcome = { service: ServiceSummary; probe: Probe | null };

/**
 * Probes services under a global and a per-adapter concurrency budget.
 *
 * Probing reaches external systems, some of which bill for activity, so the
 * budget is a property of the plugin: the host exposes the probe, this
 * decides how hard to lean on it. A slow adapter occupies its own slots only,
 * so it cannot hold up services on other adapters.
 *
 * Each outcome is delivered as soon as it is ready rather than after the
 * whole batch, so one hanging probe does not delay recording the rest. A
 * probe that throws is reported as unavailable, not rejected, for the same
 * reason. Once `signal` aborts, no further probes start.
 */
export async function probeWithBudget(
  services: readonly ServiceSummary[],
  probe: (id: string) => Promise<Probe | null>,
  limits: ProbeLimits,
  onOutcome: (outcome: ProbeOutcome) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const queue = [...services];
  const perAdapter = new Map<string, number>();
  let running = 0;

  await new Promise<void>((resolve) => {
    const finishIfIdle = () => {
      if (running === 0 && (queue.length === 0 || signal?.aborted)) resolve();
    };
    const pump = () => {
      for (
        let index = 0;
        index < queue.length &&
        running < limits.maxConcurrent &&
        !signal?.aborted;
      ) {
        const service = queue[index];
        if (!service) break;
        const used = perAdapter.get(service.adapter) ?? 0;
        if (used >= limits.maxPerAdapter) {
          index++;
          continue;
        }
        queue.splice(index, 1);
        launch(service, used);
      }
      finishIfIdle();
    };
    const launch = (service: ServiceSummary, used: number) => {
      running++;
      perAdapter.set(service.adapter, used + 1);
      void run(service).finally(() => {
        running--;
        perAdapter.set(
          service.adapter,
          (perAdapter.get(service.adapter) ?? 1) - 1,
        );
        pump();
        finishIfIdle();
      });
    };
    const run = async (service: ServiceSummary) => {
      let result: Probe | null;
      try {
        result = await probe(service.id);
      } catch {
        result = {
          id: service.id,
          health: "unavailable",
          detail: "Health probe failed",
        };
      }
      try {
        await onOutcome({ service, probe: result });
      } catch {
        // Recording one result failing must not stop the rest of the batch.
      }
    };
    pump();
  });
}
