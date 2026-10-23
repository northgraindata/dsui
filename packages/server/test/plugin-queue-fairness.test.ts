import { expect, test } from "bun:test";
import { DsuiDatabase } from "../src/db/database";
import { JobQueue } from "../src/plugins/job-queue";

test("a capped plugin backlog does not hide another plugin behind the claim window", () => {
  const database = new DsuiDatabase(":memory:");
  try {
    const queue = new JobQueue(database, 30000);
    for (const pluginId of ["busy", "other"])
      queue.upsertDefinition({
        jobId: "execute",
        pluginId,
        scheduleExpr: null,
        intervalMs: null,
        concurrency: "per-key",
        timeoutMs: 30000,
        maxAttempts: 1,
        backoffMs: 0,
        nextRunAt: null,
      });
    for (let index = 0; index < 25; index++)
      queue.enqueue({
        jobId: "execute",
        pluginId: "busy",
        input: { index },
        maxAttempts: 1,
      });
    const expected = queue.enqueue({
      jobId: "execute",
      pluginId: "other",
      input: {},
      maxAttempts: 1,
    });
    expect(queue.claim("worker", ["busy"])?.runId).toBe(expected.run.runId);
    expect(queue.claim("worker", ["busy", "other"])).toBeNull();
  } finally {
    database.sqlite.close();
  }
});
