import type { RefreshStrategy } from "./types";

/**
 * Runtime behavior behind a {@link RefreshStrategy} descriptor.
 *
 * The runtime owns exactly one policy per watched resource binding: it
 * calls {@link start} when the first watcher subscribes and {@link stop}
 * when the last unsubscribes or the adapter instance is disposed. The
 * initial fetch is always driven by the runtime itself, never by the
 * policy. Policies manage background refreshing only.
 *
 * Add new strategies by subclassing (e.g. a future streaming policy)
 * without touching resources or the runtime core.
 *
 * @example
 * ```ts
 * const policy = new PollingRefreshPolicy(5000);
 * policy.start(() => reload());
 * // ...later, on unmount:
 * policy.stop();
 * ```
 */
export abstract class RefreshPolicy {
  /**
   * Serializable descriptor this policy was built from. Carries no
   * timers or callbacks, so it can cross process boundaries.
   */
  abstract readonly spec: RefreshStrategy;

  /**
   * Begin background refreshing. Must be safe to call more than once;
   * restarting replaces any previous schedule.
   *
   * @param reload - Re-executes the watched binding. Never throws
   * synchronously; failures surface as error results.
   */
  abstract start(reload: () => void): void;

  /** Stop background refreshing and release timers or subscriptions. */
  abstract stop(): void;
}
