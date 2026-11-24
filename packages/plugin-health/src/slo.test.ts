import { expect, test } from "bun:test";
import { recordProbeResult } from "./engine.js";
import { addSample, emptyRollup } from "./rollups.js";
import { clearSlo, errorBudget, rangeStats, readSlo, writeSlo } from "./slo.js";
import { probe, service, testConfig, testDb } from "./testing.js";

function rollup(healthy: number, unavailable: number) {
  let value = emptyRollup();
  for (let i = 0; i < healthy; i++)
    value = addSample(value, {
      health: "healthy",
      latencyMs: 10,
      maintenance: false,
    });
  for (let i = 0; i < unavailable; i++)
    value = addSample(value, {
      health: "unavailable",
      latencyMs: null,
      maintenance: false,
    });
  return value;
}

test("an untouched budget has everything remaining", () => {
  const budget = errorBudget(rollup(1000, 0), {
    targetPercent: 99.9,
    windowDays: 30,
  });
  expect(budget.remainingFraction).toBe(1);
  expect(budget.met).toBe(true);
});

test("half the allowed failures leaves half the budget", () => {
  const budget = errorBudget(rollup(1998, 2), {
    targetPercent: 99.9,
    windowDays: 30,
  });
  expect(budget.consumedPercent).toBeCloseTo(0.1, 5);
  expect(budget.budgetPercent).toBeCloseTo(0.1, 5);
  expect(budget.remainingFraction).toBeCloseTo(0, 5);
});

test("missing the target makes the remaining budget negative", () => {
  const budget = errorBudget(rollup(990, 10), {
    targetPercent: 99.9,
    windowDays: 30,
  });
  expect(budget.met).toBe(false);
  expect(budget.remainingFraction ?? 0).toBeLessThan(0);
});

test("no data means no verdict", () => {
  const budget = errorBudget(emptyRollup(), {
    targetPercent: 99,
    windowDays: 7,
  });
  expect(budget.met).toBeNull();
  expect(budget.remainingFraction).toBeNull();
});

test("a 100 percent target has no budget to spend", () => {
  expect(
    errorBudget(rollup(10, 0), { targetPercent: 100, windowDays: 7 })
      .remainingFraction,
  ).toBe(1);
  expect(
    errorBudget(rollup(9, 1), { targetPercent: 100, windowDays: 7 })
      .remainingFraction,
  ).toBe(-1);
});

test("a target set in the UI overrides configuration and can be cleared", () => {
  const db = testDb();
  const config = testConfig({
    services: { db: { sloTarget: 99, sloWindowDays: 7 } },
  });
  expect(readSlo(db, config, "db")).toMatchObject({
    targetPercent: 99,
    source: "configuration",
  });
  writeSlo(
    db,
    { serviceId: "db", targetPercent: 99.95, windowDays: 30, actor: "ana" },
    1,
  );
  expect(readSlo(db, config, "db")).toMatchObject({
    targetPercent: 99.95,
    windowDays: 30,
    source: "ui",
  });
  clearSlo(db, "db");
  expect(readSlo(db, config, "db")?.source).toBe("configuration");
  expect(readSlo(db, config, "other")).toBeNull();
});

test("range statistics come from rollups and agree with the samples", () => {
  const db = testDb();
  const config = testConfig();
  const svc = service("db");
  const now = Date.now();
  const latencies = [10, 20, 30, 40, 500];
  for (const [index, latencyMs] of latencies.entries())
    recordProbeResult(
      db,
      config,
      svc,
      probe("db", "healthy", { latencyMs }),
      now - (5 - index) * 1000,
    );
  const stats = rangeStats(db, "db", 7, now);
  expect(stats.measured).toBe(5);
  expect(stats.availability).toBe(100);
  expect(stats.averageLatencyMs).toBe(120);
  expect(stats.p50).toBeLessThan(stats.p99 ?? 0);
});
