import { describe, expect, test } from "bun:test";
import type { ShaperApp } from "../src/context.js";
import { newTaskRuns } from "../src/jobs.js";

const task = (id: string, lastRunAt?: string): ShaperApp => ({
  id,
  type: "task",
  path: "/",
  name: id,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  taskInfo: lastRunAt ? { lastRunAt, lastRunSuccess: true } : {},
});

describe("newTaskRuns", () => {
  test("reports only tasks whose last run changed", () => {
    const tasks = [task("a", "t2"), task("b", "t1"), task("c")];
    const runs = newTaskRuns(tasks, { a: "t1", b: "t1" });
    expect(runs.map((run) => run.task.id)).toEqual(["a"]);
  });

  test("reports a task that has never been seen", () => {
    expect(newTaskRuns([task("a", "t1")], {})).toHaveLength(1);
  });
});
