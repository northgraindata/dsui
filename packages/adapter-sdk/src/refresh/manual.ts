import { RefreshPolicy } from "./policy";
import type { RefreshStrategy } from "./types";

/**
 * Manual refresh policy: never refreshes on its own.
 *
 * The runtime still performs the initial fetch on mount; this policy
 * only guarantees no timers or subscriptions are ever created.
 *
 * @example
 * ```ts
 * const policy = new ManualRefreshPolicy();
 * policy.start(() => reload()); // no-op
 * policy.stop(); // no-op
 * ```
 */
export class ManualRefreshPolicy extends RefreshPolicy {
  /** Serializable descriptor: `{ kind: "manual" }`. */
  readonly spec: RefreshStrategy = { kind: "manual" };

  /**
   * No background work to begin.
   *
   * @param reload - Accepted for interface conformance; never called.
   */
  start(): void {
    // Intentionally empty: manual resources refresh via explicit calls.
  }

  /** Nothing to clean up. */
  stop(): void {
    // Intentionally empty: no timers or subscriptions exist.
  }
}
