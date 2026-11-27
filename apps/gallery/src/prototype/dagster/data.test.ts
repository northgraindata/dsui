import { expect, test } from "bun:test";
import { instigators } from "./ops";
import { runs, stepsOf } from "./runs";

test("no two ticks of a schedule or sensor share a time", () => {
  for (const item of instigators)
    expect(new Set(item.ticks.map((tick) => tick.at.getTime())).size).toBe(
      item.ticks.length,
    );
});

test("a failed run has one failed step and skips what depends on it", () => {
  for (const run of runs.filter((item) => item.status === "FAILURE")) {
    const steps = stepsOf(run);
    const failed = steps.filter((step) => step.status === "FAILURE");
    expect(failed.map((step) => step.key)).toEqual([run.failure?.step ?? ""]);
    for (const step of steps)
      if (step.upstream.includes(run.failure?.step ?? ""))
        expect(step.status).toBe("SKIPPED");
  }
});
