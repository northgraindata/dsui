/**
 * Runtime behavior behind a refresh descriptor.
 *
 * The runtime owns exactly one policy per watched resource binding: it
 * calls {@link start} when the first watcher subscribes and {@link stop}
 * when the last unsubscribes or the adapter instance is disposed. The
 * initial fetch is always driven by the runtime itself, never by the
 * policy. Policies manage background refreshing only.
 *
 * Add new strategies (e.g. a future streaming policy) by implementing this
 * interface without touching resources or the runtime core.
 */
export interface RefreshPolicy {
  /**
   * Begin background refreshing. Must be safe to call more than once;
   * restarting replaces any previous schedule.
   *
   * @param reload - Re-executes the watched binding. Never throws
   * synchronously; failures surface as error results.
   */
  start(reload: () => void): void;

  /** Stop background refreshing and release timers or subscriptions. */
  stop(): void;
}
