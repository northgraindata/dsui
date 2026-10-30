import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  JobConcurrency,
  RuntimePluginJob,
} from "@northgraindata/dsui-plugin-sdk";
import { DsuiDatabase } from "../src/db/database";
import { PluginJobService } from "../src/plugins/job-service";

type Registered = { pluginId: string; job: RuntimePluginJob };

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

function job(
  id: string,
  concurrency: JobConcurrency,
  invoke: RuntimePluginJob["invoke"],
  timeoutMs = 10_000,
): RuntimePluginJob {
  return {
    id,
    concurrency,
    timeoutMs,
    retry: { maxAttempts: 1, backoffMs: 0 },
    invoke,
  };
}

async function service(
  registered: Registered[],
  options?: { maxConcurrentRuns?: number },
) {
  const directory = await mkdtemp(join(tmpdir(), "dsui-job-service-"));
  const database = new DsuiDatabase(join(directory, "state.sqlite"));
  const jobs = new PluginJobService(
    database,
    () => registered,
    undefined,
    options,
  );
  await jobs.start();
  cleanups.push(async () => {
    await jobs.close();
    database.sqlite.close();
    await rm(directory, { recursive: true, force: true });
  });
  return jobs;
}

async function until(condition: () => boolean, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for job");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("a long running job does not block jobs of other plugins", async () => {
  const slow = gate();
  const events: string[] = [];
  const jobs = await service([
    {
      pluginId: "diagnostics",
      job: job("investigate", "per-key", async () => {
        events.push("slow:start");
        await slow.opened;
        events.push("slow:end");
      }),
    },
    {
      pluginId: "mcp",
      job: job("call", "per-key", async () => {
        events.push("fast:run");
      }),
    },
  ]);

  jobs.enqueue("diagnostics", "investigate", { id: "a" });
  await until(() => events.includes("slow:start"));
  jobs.enqueue("mcp", "call", { id: "b" });

  await until(() => events.includes("fast:run"));
  expect(events).not.toContain("slow:end");
  slow.open();
  await until(() => events.includes("slow:end"));
});

test("per-key runs with different inputs overlap while equal inputs do not", async () => {
  const release = gate();
  let running = 0;
  let peak = 0;
  const started: string[] = [];
  const jobs = await service([
    {
      pluginId: "p",
      job: job("work", "per-key", async (input) => {
        started.push(JSON.stringify(input));
        running += 1;
        peak = Math.max(peak, running);
        await release.opened;
        running -= 1;
      }),
    },
  ]);

  jobs.enqueue("p", "work", { key: "a" });
  jobs.enqueue("p", "work", { key: "b" });
  await until(() => started.length === 2);
  expect(peak).toBe(2);

  jobs.enqueue("p", "work", { key: "a" });
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(started).toHaveLength(2);

  release.open();
  await until(() => started.length === 3);
});

test("singleton jobs never overlap with themselves", async () => {
  const release = gate();
  let running = 0;
  let peak = 0;
  let finished = 0;
  const jobs = await service([
    {
      pluginId: "p",
      job: job("only", "singleton", async () => {
        running += 1;
        peak = Math.max(peak, running);
        await release.opened;
        running -= 1;
        finished += 1;
      }),
    },
  ]);

  jobs.enqueue("p", "only", { n: 1 });
  jobs.enqueue("p", "only", { n: 2 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(peak).toBe(1);

  release.open();
  await until(() => finished === 2);
  expect(peak).toBe(1);
});

test("the worker pool never exceeds its configured size", async () => {
  const release = gate();
  let running = 0;
  let peak = 0;
  let finished = 0;
  const jobs = await service(
    [
      {
        pluginId: "p",
        job: job("work", "per-key", async () => {
          running += 1;
          peak = Math.max(peak, running);
          await release.opened;
          running -= 1;
          finished += 1;
        }),
      },
    ],
    { maxConcurrentRuns: 2 },
  );

  for (let n = 0; n < 5; n += 1) jobs.enqueue("p", "work", { n });
  await until(() => running === 2);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(running).toBe(2);

  release.open();
  await until(() => finished === 5);
  expect(peak).toBe(2);
});

test("closing the service aborts every running job", async () => {
  const aborted: string[] = [];
  const started: string[] = [];
  const hold =
    (name: string): RuntimePluginJob["invoke"] =>
    (_input, context) =>
      new Promise<void>((resolve) => {
        started.push(name);
        context.signal.addEventListener("abort", () => {
          aborted.push(name);
          resolve();
        });
      });
  const jobs = await service([
    { pluginId: "p", job: job("one", "per-key", hold("one")) },
    { pluginId: "p", job: job("two", "per-key", hold("two")) },
  ]);

  jobs.enqueue("p", "one", null);
  jobs.enqueue("p", "two", null);
  await until(() => started.length === 2);

  await jobs.close();
  expect(aborted.sort()).toEqual(["one", "two"]);
});
