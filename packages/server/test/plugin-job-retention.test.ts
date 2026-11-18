import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DsuiDatabase } from "../src/db/database";
import { JobQueue } from "../src/plugins/job-queue";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const DAY_MS = 24 * 60 * 60 * 1000;

test("history pruning removes old scheduled successes and keeps retried manual runs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-job-retention-"));
  const database = new DsuiDatabase(join(directory, "state.sqlite"));
  cleanups.push(async () => {
    database.sqlite.close();
    await rm(directory, { recursive: true, force: true });
  });
  let now = new Date("2026-01-01T00:00:00.000Z");
  const queue = new JobQueue(database, 60_000, () => now);
  queue.upsertDefinition({
    jobId: "sync",
    pluginId: "demo",
    scheduleExpr: null,
    intervalMs: 60_000,
    concurrency: "per-key",
    timeoutMs: 10_000,
    maxAttempts: 2,
    backoffMs: 0,
    nextRunAt: null,
  });

  const scheduled = queue.enqueue({
    jobId: "sync",
    pluginId: "demo",
    input: null,
    maxAttempts: 2,
    scheduledFor: now,
    origin: "schedule",
  }).run;
  expect(queue.claim("worker")?.runId).toBe(scheduled.runId);
  expect(queue.succeed(scheduled.runId, "worker")).toBe(true);

  const manual = queue.enqueue({
    jobId: "sync",
    pluginId: "demo",
    input: { manual: true },
    maxAttempts: 2,
  }).run;
  expect(queue.claim("worker")?.runId).toBe(manual.runId);
  queue.fail(manual.runId, "worker", "boom", { retryAt: now });
  expect(queue.getRun(manual.runId)?.scheduledFor).not.toBeNull();
  expect(queue.claim("worker")?.runId).toBe(manual.runId);
  expect(queue.succeed(manual.runId, "worker")).toBe(true);

  now = new Date(now.getTime() + 3 * DAY_MS);
  expect(queue.pruneScheduledSuccesses(2 * DAY_MS)).toBe(1);
  expect(queue.getRun(scheduled.runId)).toBeNull();
  expect(queue.getRun(manual.runId)?.status).toBe("succeeded");
});
