import { expect, test } from "bun:test";
import {
  backfillStates,
  checkStates,
  runStates,
  stepStates,
  tickStates,
} from "./states";

/* Copied from the enums in Dagster's GraphQL schema (read 27 November 2026). */
const schema = [
  [
    runStates,
    "QUEUED NOT_STARTED MANAGED STARTING STARTED SUSPENDED SUCCESS FAILURE CANCELING CANCELED",
  ],
  [stepStates, "SKIPPED SUCCESS FAILURE IN_PROGRESS"],
  [checkStates, "IN_PROGRESS SUCCEEDED FAILED EXECUTION_FAILED SKIPPED"],
  [tickStates, "STARTED SKIPPED SUCCESS FAILURE"],
  [
    backfillStates,
    "REQUESTED COMPLETED FAILED CANCELED CANCELING COMPLETED_SUCCESS COMPLETED_FAILED FAILING",
  ],
] as const;

test("every state in the schema has a label and a tone, and no other", () => {
  for (const [states, names] of schema)
    expect(Object.keys(states).sort()).toEqual(names.split(" ").sort());
});
