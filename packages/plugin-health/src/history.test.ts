import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertDatabaseName } from "@northgraindata/dsui-plugin-sdk";
import { joinProbes, type ProbeResult } from "./context";
import { readHistory, recordChecks } from "./history";
import {
  bucketHistory,
  HISTORY_BUCKET_MS,
  HISTORY_RETENTION_MS,
  HISTORY_WINDOW_MS,
} from "./history-model";
import { createHealthPlugin } from "./plugin";

test("history preserves missing hours and the worst check in an hour", () => {
  const now = Date.UTC(2026, 9, 18, 12, 30);
  const time = Math.floor(now / HISTORY_BUCKET_MS) * HISTORY_BUCKET_MS;
  const result = bucketHistory(
    [
      { time, health: "healthy", latencyMs: 20 },
      { time: time + 1, health: "unavailable", latencyMs: null },
      { time: time + 2, health: "healthy", latencyMs: 40 },
      { time: now + 1, health: "warning", latencyMs: 100 },
      { time: now - HISTORY_WINDOW_MS - 1, health: "healthy", latencyMs: 1 },
    ],
    now,
  );
  expect(result).toHaveLength(168);
  expect(result.slice(0, -1).every((bucket) => bucket.health === null)).toBe(
    true,
  );
  expect(result[167]).toMatchObject({
    health: "unavailable",
    samples: 3,
    latencyMs: 30,
  });
});

test("SQLite checks survive reopening, restrict reads to visible IDs and prune old data", () => {
  const directory = mkdtempSync(join(tmpdir(), "dsui-health-history-"));
  let database = new Database(join(directory, "health-history.sqlite"));
  const storage = {
    openDatabase(name: string) {
      assertDatabaseName(name);
      return database;
    },
  };
  const sample: ProbeResult = {
    id: "visible",
    name: "Visible",
    adapter: "test",
    managedBy: "ui",
    health: "healthy",
    latencyMs: 12,
  };
  const now = Date.now();
  try {
    recordChecks(storage, [sample], now - HISTORY_RETENTION_MS - 1);
    recordChecks(
      storage,
      [sample, { ...sample, id: "private", health: "unavailable" }],
      now,
    );
    // The real host reuses handles until shutdown; readers must not close them.
    database.close();
    database = new Database(join(directory, "health-history.sqlite"));
    const result = readHistory(storage, ["visible", "missing"], now);
    expect([...result.keys()]).toEqual(["visible", "missing"]);
    expect(result.get("visible")).toEqual([
      { time: now, health: "healthy", latencyMs: 12 },
    ]);
    expect(result.get("missing")).toEqual([]);
    expect(
      database
        .query<{ count: number }, []>("SELECT count(*) AS count FROM checks")
        .get()?.count,
    ).toBe(2);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("probe cadence has bounded configuration and defaults to one hour", () => {
  const schema = createHealthPlugin().configSchema;
  expect(schema.parse({}).checkIntervalMs).toBe(3_600_000);
  expect(schema.parse({}).timeoutMs).toBe(30_000);
  expect(() => schema.parse({ checkIntervalMs: 999 })).toThrow();
  expect(() => schema.parse({ checkIntervalMs: 3_600_001 })).toThrow();
});

test("slow successful adapter checks stay healthy in the overview and history", () => {
  const service = {
    id: "dbt",
    name: "dbt",
    adapter: "dbt",
    managedBy: "ui" as const,
  };
  const [result] = joinProbes(
    [service],
    new Map([
      [
        service.id,
        { id: service.id, health: "healthy" as const, latencyMs: 4000 },
      ],
    ]),
  );
  expect(result.health).toBe("healthy");
  const now = Date.now();
  const buckets = bucketHistory(
    [{ time: now, health: result.health, latencyMs: result.latencyMs ?? null }],
    now,
  );
  expect(buckets.at(-1)).toMatchObject({ health: "healthy", latencyMs: 4000 });
});
