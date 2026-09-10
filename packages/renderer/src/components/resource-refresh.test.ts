import { expect, test } from "bun:test";
import { watchResource } from "./resource-refresh";

const flush = () => Promise.resolve().then(() => Promise.resolve());

test("polls after each completed resource request and stops cleanly", async () => {
  const scheduled: Array<{
    callback: () => void;
    delayMs: number;
    cancelled: boolean;
  }> = [];
  let reads = 0;
  const values: unknown[] = [];
  const stop = watchResource(
    {
      resourceId: "tasks",
      refresh: { kind: "poll", intervalMs: 2000 },
    },
    async () => ++reads,
    (data) => values.push(data),
    () => undefined,
    (callback, delayMs) => {
      const pending = { callback, delayMs, cancelled: false };
      scheduled.push(pending);
      return () => {
        pending.cancelled = true;
      };
    },
  );

  await flush();
  expect(values).toEqual([1]);
  expect(scheduled[0]?.delayMs).toBe(2000);

  scheduled[0]?.callback();
  await flush();
  expect(values).toEqual([1, 2]);

  stop();
  expect(scheduled[1]?.cancelled).toBe(true);
  scheduled[1]?.callback();
  await flush();
  expect(reads).toBe(2);
});

test("a manual resource executes only once", async () => {
  let reads = 0;
  let schedules = 0;
  watchResource(
    { resourceId: "tasks" },
    async () => ++reads,
    () => undefined,
    () => undefined,
    () => {
      schedules += 1;
      return () => undefined;
    },
  );
  await flush();
  expect(reads).toBe(1);
  expect(schedules).toBe(0);
});
