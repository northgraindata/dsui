/*
 * Every state Dagster's GraphQL API can report, with the label people read and
 * the shared tone that colours it. states.test.ts compares the keys with the
 * enums in Dagster's schema:
 * https://github.com/dagster-io/dagster/blob/master/js_modules/ui-core/src/graphql/schema.graphql
 */
export type Tone =
  | "success"
  | "failed"
  | "running"
  | "queued"
  | "scheduled"
  | "restarting"
  | "removed"
  | "skipped"
  | "up_for_retry"
  | "none";

type Table<K extends string> = Record<K, readonly [label: string, tone: Tone]>;

const table = <K extends string>(rows: Table<K>) => rows;

/** `RunStatus` */
export const runStates = table({
  QUEUED: ["Queued", "queued"],
  NOT_STARTED: ["Not started", "scheduled"],
  MANAGED: ["Managed", "scheduled"],
  STARTING: ["Starting", "running"],
  STARTED: ["Started", "running"],
  SUSPENDED: ["Suspended", "scheduled"],
  SUCCESS: ["Success", "success"],
  FAILURE: ["Failure", "failed"],
  CANCELING: ["Canceling", "restarting"],
  CANCELED: ["Canceled", "removed"],
});
export type RunStatus = keyof typeof runStates;

/** `StepEventStatus`; a step without one has not started. */
export const stepStates = table({
  SKIPPED: ["Skipped", "skipped"],
  SUCCESS: ["Success", "success"],
  FAILURE: ["Failure", "failed"],
  IN_PROGRESS: ["In progress", "running"],
});
export type StepStatus = keyof typeof stepStates;

/** `AssetCheckExecutionResolvedStatus` */
export const checkStates = table({
  IN_PROGRESS: ["In progress", "running"],
  SUCCEEDED: ["Passed", "success"],
  FAILED: ["Failed", "failed"],
  EXECUTION_FAILED: ["Execution failed", "failed"],
  SKIPPED: ["Skipped", "skipped"],
});
export type CheckStatus = keyof typeof checkStates;

/** `InstigationTickStatus` */
export const tickStates = table({
  STARTED: ["Evaluating", "running"],
  SKIPPED: ["Skipped", "skipped"],
  SUCCESS: ["Requested runs", "success"],
  FAILURE: ["Failure", "failed"],
});
export type TickStatus = keyof typeof tickStates;

/** `BulkActionStatus`, the state of a backfill. */
export const backfillStates = table({
  REQUESTED: ["In progress", "running"],
  COMPLETED: ["Completed", "success"],
  COMPLETED_SUCCESS: ["Succeeded", "success"],
  COMPLETED_FAILED: ["Completed with failures", "failed"],
  FAILING: ["Failing", "up_for_retry"],
  FAILED: ["Failed", "failed"],
  CANCELING: ["Canceling", "restarting"],
  CANCELED: ["Canceled", "removed"],
});
export type BackfillStatus = keyof typeof backfillStates;
