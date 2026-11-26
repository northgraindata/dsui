import { describe, expect, test } from "bun:test";
import {
  DAG_RUN_STATES,
  stateName,
  stateTone,
  TASK_STATES,
} from "../src/states";

/**
 * Copied from the `TaskInstanceState` enum of Airflow 3's OpenAPI spec and the
 * `TaskState` enum of 2.10's, which adds no state of its own beyond `none`.
 */
const AIRFLOW_3 = [
  "removed",
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
];

describe("Airflow states", () => {
  test("cover every task state of the API", () => {
    expect([...TASK_STATES].sort()).toEqual([...AIRFLOW_3, "none"].sort());
  });

  test("give each state a name, and only inactive ones a muted tone", () => {
    const muted = TASK_STATES.filter((state) => stateTone(state) === "muted");
    expect(muted.sort()).toEqual(["none", "removed", "skipped"]);
    for (const state of TASK_STATES)
      expect(stateName(state)).not.toContain("_");
    expect(stateName("awaiting_input")).toBe("Awaiting input");
    expect(stateName(null)).toBe("Not run");
  });

  test("keep the name of a state added by a later Airflow", () => {
    expect(stateTone("brand_new")).toBe("muted");
    expect(stateName("brand_new")).toBe("Brand new");
  });

  test("knows the four DAG run states", () => {
    expect([...DAG_RUN_STATES]).toEqual([
      "queued",
      "running",
      "success",
      "failed",
    ]);
  });
});
