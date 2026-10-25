import { expect, test } from "bun:test";
import {
  ingestActivity,
  pruneActivity,
  readActivity,
  recordActivity,
  summarize,
} from "./activity.js";
import { isWorkspacePath } from "./href.js";
import { testDb } from "./testing.js";

const T = Date.UTC(2026, 5, 1, 12, 0, 0);
const MIN = 60_000;

const event = (
  signalId: string,
  minutes: number,
  extra: Record<string, unknown> = {},
) => ({
  id: `${signalId}-${minutes}`,
  signalId,
  type: "error" as const,
  sourceType: "adapter",
  sourceId: "x",
  serviceId: "dbt",
  payload: { message: "boom" },
  occurredAt: new Date(T + minutes * MIN).toISOString(),
  ...extra,
});

function reader(pages: ReturnType<typeof event>[][]) {
  let index = 0;
  const calls: Array<{ cursor?: string }> = [];
  return {
    calls,
    read: async (options?: { cursor?: string }) => {
      calls.push({ cursor: options?.cursor });
      if (options?.cursor === "latest")
        return { items: [], cursor: "tail", hasMore: false };
      const items = pages[index] ?? [];
      index++;
      return {
        items,
        cursor: `c${index}`,
        hasMore: index < pages.length,
      };
    },
  };
}

test("a summary comes from the conventional fields of a payload", () => {
  expect(summarize({ summary: "  Disk   full " })).toBe("Disk full");
  expect(summarize({ message: "boom" })).toBe("boom");
  expect(summarize({ error: "x".repeat(500) })?.length).toBe(200);
  expect(summarize({ other: 1 })).toBeNull();
  expect(summarize("text")).toBeNull();
  expect(summarize(null)).toBeNull();
});

test("repeats of one signal within minutes fold into one row", () => {
  const db = testDb();
  for (let i = 0; i < 50; i++)
    recordActivity(db, {
      serviceId: "ch",
      signalId: "clickhouse.query-succeeded",
      type: "success",
      time: T + i * 1000,
      summary: null,
    });
  recordActivity(db, {
    serviceId: "ch",
    signalId: "clickhouse.query-succeeded",
    type: "success",
    time: T + 30 * MIN,
    summary: null,
  });
  const rows = readActivity(db, "ch", T, T + 60 * MIN);
  expect(rows.map((row) => row.count)).toEqual([50, 1]);
});

test("the first run starts at the current tail and replays nothing", async () => {
  const db = testDb();
  const source = reader([[event("dbt.run-failed", 0)]]);
  expect(await ingestActivity(db, source.read, "health.")).toBe(0);
  expect(source.calls).toEqual([{ cursor: "latest" }]);
  expect(readActivity(db, "dbt", 0, T * 2)).toEqual([]);
});

test("later runs read from the stored cursor, across pages", async () => {
  const db = testDb();
  await ingestActivity(db, reader([]).read, "health.");
  const source = reader([
    [event("dbt.run-failed", 1)],
    [event("code-repository.updated", 2, { type: "success" })],
  ]);
  expect(await ingestActivity(db, source.read, "health.")).toBe(2);
  expect(source.calls.map((call) => call.cursor)).toEqual(["tail", "c1"]);
  const rows = readActivity(db, "dbt", T, T + 10 * MIN);
  expect(rows.map((row) => row.signalId)).toEqual([
    "dbt.run-failed",
    "code-repository.updated",
  ]);
  expect(rows[0]?.summary).toBe("boom");
  // The cursor advanced, so a repeat run starts after what was read.
  const again = reader([]);
  await ingestActivity(db, again.read, "health.");
  expect(again.calls[0]?.cursor).toBe("c2");
});

test("signals without a service and this plugin's own are skipped", async () => {
  const db = testDb();
  await ingestActivity(db, reader([]).read, "health.");
  const source = reader([
    [
      event("health.service-unavailable", 1),
      event("dbt.run-failed", 2, { serviceId: undefined }),
      event("dbt.run-failed", 3),
    ],
  ]);
  expect(await ingestActivity(db, source.read, "health.")).toBe(1);
});

test("a host without event reading simply records nothing", async () => {
  expect(await ingestActivity(testDb(), undefined, "health.")).toBe(0);
});

test("old activity is pruned", () => {
  const db = testDb();
  const now = T + 40 * 24 * 60 * MIN;
  for (const time of [T, now - MIN])
    recordActivity(db, {
      serviceId: "a",
      signalId: "s",
      type: "info",
      time,
      summary: null,
    });
  pruneActivity(db, now);
  expect(readActivity(db, "a", 0, now * 2).map((row) => row.time)).toEqual([
    now - MIN,
  ]);
});

test("only plain workspace paths are accepted for a check link", () => {
  expect(isWorkspacePath("/dags")).toBe(true);
  expect(isWorkspacePath("/dags/etl?tab=runs")).toBe(true);
  for (const bad of [
    "dags",
    "//evil.example",
    "https://evil.example",
    "/a\\b",
    "/a\nb",
    `/${"x".repeat(200)}`,
    "",
    undefined,
    42,
  ])
    expect(isWorkspacePath(bad)).toBe(false);
});
