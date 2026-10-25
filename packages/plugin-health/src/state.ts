import type { Health } from "./context.js";

/** What the state machine remembers about one service between probes. */
export type StateCore = {
  health: Health;
  /** When the service entered `health`, in epoch milliseconds. */
  since: number;
  /** A different result being observed repeatedly, not yet accepted. */
  pending: Health | null;
  pendingCount: number;
};

export type Thresholds = {
  failureThreshold: number;
  recoveryThreshold: number;
};

export type Advance = {
  next: StateCore;
  /** The previous accepted health; `null` on the first observation. */
  from: Health | null;
  changed: boolean;
};

/**
 * Applies one probe result to a service's state.
 *
 * A service changes state only after several consecutive results agree, so a
 * single failed check does not raise an incident and a single success does
 * not close one. `unknown` carries no information: it neither confirms the
 * current state nor counts toward a change, because "we could not tell" is
 * not evidence either way.
 *
 * The first observation is accepted as is, since there is no earlier state
 * to debounce against.
 */
export function advance(
  previous: StateCore | null,
  observed: Health,
  now: number,
  thresholds: Thresholds,
): Advance {
  if (previous === null) {
    return {
      next: { health: observed, since: now, pending: null, pendingCount: 0 },
      from: null,
      changed: true,
    };
  }
  if (observed === "unknown") {
    return { next: previous, from: previous.health, changed: false };
  }
  if (observed === previous.health) {
    return {
      next: { ...previous, pending: null, pendingCount: 0 },
      from: previous.health,
      changed: false,
    };
  }
  const count = previous.pending === observed ? previous.pendingCount + 1 : 1;
  const needed =
    observed === "healthy"
      ? thresholds.recoveryThreshold
      : thresholds.failureThreshold;
  if (count >= needed) {
    return {
      next: { health: observed, since: now, pending: null, pendingCount: 0 },
      from: previous.health,
      changed: true,
    };
  }
  return {
    next: { ...previous, pending: observed, pendingCount: count },
    from: previous.health,
    changed: false,
  };
}
