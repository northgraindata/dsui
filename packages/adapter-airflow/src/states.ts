/**
 * Every state in Airflow's REST API, in one place. A state missing from here
 * would look like a task that never ran.
 */
export const TASK_STATES = [
  "none",
  "scheduled",
  "queued",
  "running",
  "success",
  "restarting",
  "failed",
  "up_for_retry",
  "up_for_reschedule",
  "upstream_failed",
  "skipped",
  "deferred",
  "awaiting_input",
  "removed",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

/** DAG runs have only these four; "skipped" exists for tasks alone. */
export const DAG_RUN_STATES = [
  "queued",
  "running",
  "success",
  "failed",
] as const;

export type DagRunState = (typeof DAG_RUN_STATES)[number];

export type StateTone =
  | "healthy"
  | "unavailable"
  | "info"
  | "warning"
  | "muted";

const tones: Record<TaskState, StateTone> = {
  none: "muted",
  scheduled: "info",
  queued: "info",
  running: "info",
  success: "healthy",
  restarting: "warning",
  failed: "unavailable",
  up_for_retry: "warning",
  up_for_reschedule: "warning",
  upstream_failed: "unavailable",
  skipped: "muted",
  deferred: "warning",
  // A person has to act before the task can continue.
  awaiting_input: "warning",
  removed: "muted",
};

const isTaskState = (value: string): value is TaskState =>
  (TASK_STATES as readonly string[]).includes(value);

/** A state this table does not know stays muted and keeps its own name. */
export function stateTone(state: string): StateTone {
  const known = state.toLowerCase();
  return isTaskState(known) ? tones[known] : "muted";
}

/** Airflow states such as `upstream_failed`, as "Upstream failed". */
export function stateName(state: string | null | undefined): string {
  if (!state || state === "none") return "Not run";
  const words = state.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
