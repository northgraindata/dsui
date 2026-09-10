import type { ResourceReference } from "@northgraindata/dsui-core";

type Schedule = (callback: () => void, delayMs: number) => () => void;

const scheduleTimeout: Schedule = (callback, delayMs) => {
  const timer = setTimeout(callback, delayMs);
  return () => clearTimeout(timer);
};

/** Executes once, then polls serially when the reference declares polling. */
export function watchResource(
  reference: ResourceReference,
  execute: (reference: ResourceReference) => Promise<unknown>,
  onData: (data: unknown) => void,
  onError: (cause: unknown) => void,
  schedule: Schedule = scheduleTimeout,
): () => void {
  let active = true;
  let cancelScheduled: (() => void) | undefined;

  const load = async () => {
    if (!active) return;
    try {
      const data = await execute(reference);
      if (active) onData(data);
    } catch (cause) {
      if (active) onError(cause);
    } finally {
      if (active && reference.refresh?.kind === "poll") {
        cancelScheduled = schedule(
          () => void load(),
          reference.refresh.intervalMs,
        );
      }
    }
  };

  void load();
  return () => {
    active = false;
    cancelScheduled?.();
  };
}
