import { expect, test } from "bun:test";
import {
  addSample,
  availabilityOf,
  emptyRollup,
  LATENCY_EDGES,
  mergeRollups,
  percentile,
} from "./rollups.js";

function fill(latencies: number[]) {
  let rollup = emptyRollup();
  for (const latencyMs of latencies)
    rollup = addSample(rollup, {
      health: "healthy",
      latencyMs,
      maintenance: false,
    });
  return rollup;
}

test("percentiles from the histogram stay within one bucket of the exact value", () => {
  const latencies = Array.from(
    { length: 1000 },
    (_, i) => 5 + ((i * 37) % 900),
  );
  const rollup = fill(latencies);
  const sorted = [...latencies].sort((a, b) => a - b);
  for (const fraction of [0.5, 0.95, 0.99]) {
    const exact = sorted[Math.ceil(fraction * sorted.length) - 1] ?? 0;
    const estimate = percentile(rollup, fraction) ?? -1;
    const upper = LATENCY_EDGES.find((edge) => edge > exact) ?? Infinity;
    const lower =
      [...LATENCY_EDGES].reverse().find((edge) => edge <= exact) ?? 0;
    expect(estimate).toBeGreaterThanOrEqual(lower);
    expect(estimate).toBeLessThanOrEqual(upper);
  }
});

test("percentiles of an empty rollup are null", () => {
  expect(percentile(emptyRollup(), 0.5)).toBeNull();
});

test("merging buckets adds counters and keeps extremes", () => {
  const merged = mergeRollups([fill([10, 20]), fill([5, 400])]);
  expect(merged.healthy).toBe(4);
  expect(merged.latencyMin).toBe(5);
  expect(merged.latencyMax).toBe(400);
  expect(merged.latencySum).toBe(435);
});

test("availability excludes unknown and maintenance and counts degraded as available", () => {
  let rollup = emptyRollup();
  for (const health of [
    "healthy",
    "healthy",
    "warning",
    "unavailable",
    "unknown",
    "unknown",
  ] as const)
    rollup = addSample(rollup, { health, latencyMs: null, maintenance: false });
  for (let i = 0; i < 10; i++)
    rollup = addSample(rollup, {
      health: "unavailable",
      latencyMs: null,
      maintenance: true,
    });
  const result = availabilityOf(rollup);
  expect(result.measured).toBe(4);
  expect(result.availability).toBe(75);
  expect(result.healthyShare).toBe(50);
});

test("no measurements means no availability rather than zero", () => {
  expect(availabilityOf(emptyRollup()).availability).toBeNull();
});

test("slow successful checks stay healthy and are recorded as latency only", () => {
  const rollup = addSample(emptyRollup(), {
    health: "healthy",
    latencyMs: 4000,
    maintenance: false,
  });
  expect(rollup.healthy).toBe(1);
  expect(rollup.unavailable).toBe(0);
  expect(rollup.latencyMax).toBe(4000);
});
