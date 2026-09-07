import { InvalidDefinitionError } from "../shared/errors";
import { RefreshPolicy } from "./policy";
import type { RefreshStrategy } from "./types";

/**
 * Polling refresh policy: re-runs the watched binding on a fixed interval.
 *
 * The runtime stops the policy when the last watcher unsubscribes, so
 * intervals never outlive their page. Timers are unref'd where the
 * platform supports it, so polling never holds a process open.
 *
 * @example
 * ```ts
 * const policy = new PollingRefreshPolicy(5000);
 * policy.start(() => reload());
 * // ...later, on unmount:
 * policy.stop();
 * ```
 */
export class PollingRefreshPolicy extends RefreshPolicy {
  /** Serializable descriptor: `{ kind: "poll", intervalMs }`. */
  readonly spec: Extract<RefreshStrategy, { kind: "poll" }>;

  /**
   * @param intervalMs - Positive, finite milliseconds between reloads.
   * @throws {@link InvalidDefinitionError} for non-positive intervals.
   */
  constructor(intervalMs: number) {
    super();
    if (!Number.isFinite(intervalMs) || intervalMs <= 0)
      throw new InvalidDefinitionError(
        `Invalid poll interval: ${String(intervalMs)}`,
      );
    this.spec = { kind: "poll", intervalMs };
  }

  private timer: ReturnType<typeof setInterval> | undefined;

  /**
   * Begin polling. Restarting replaces any previous schedule.
   *
   * @param reload - Invoked every interval; failures surface as error
   * results, never as thrown exceptions.
   */
  start(reload: () => void): void {
    this.stop();
    const timer: ReturnType<typeof setInterval> = setInterval(
      reload,
      this.spec.intervalMs,
    );
    this.timer = timer;
    if (typeof timer === "object" && timer !== null && "unref" in timer)
      (timer as unknown as { unref(): void }).unref();
  }

  /** Clear the interval, if any. Safe to call when never started. */
  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
