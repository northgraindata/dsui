import { adapterBucket } from "./index";

/** The faults telemetry counts. Fixed names, so nothing a user typed can leak in. */
export type ErrorCategory =
  | "action_failed"
  | "adapter_load_failed"
  | "resource_query_failed"
  | "unhandled_error";

export type ErrorCounter = {
  /** Counts one fault; a built-in adapter is named, any other is "other". */
  record(category: ErrorCategory, adapterId?: string): void;
  /** Counts since the last call, which are then forgotten. */
  drain(): Record<string, number>;
};

/**
 * Counts faults by category and built-in adapter. No message, stack trace, id
 * or path is kept: those can carry hostnames and credentials, so only how
 * often something failed leaves the process.
 */
export function createErrorCounter(): ErrorCounter {
  let counts = new Map<string, number>();
  return {
    record(category, adapterId) {
      const key = adapterId
        ? `${category}.${adapterBucket(adapterId)}`
        : category;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
    drain() {
      const drained = Object.fromEntries(counts);
      counts = new Map();
      return drained;
    },
  };
}
