import { expect, test } from "bun:test";
import { configSchema, intervalFor } from "./config.js";

test("an empty configuration is valid and uses sensible defaults", () => {
  const config = configSchema.parse({});
  expect(config.defaultIntervalMs).toBe(300_000);
  expect(config.timeoutMs).toBe(30_000);
  expect(config.failureThreshold).toBe(2);
  expect(config.maxConcurrentProbesPerAdapter).toBe(2);
});

test("the original checkIntervalMs name still works and the new one wins", () => {
  expect(
    configSchema.parse({ checkIntervalMs: 60_000 }).defaultIntervalMs,
  ).toBe(60_000);
  expect(
    configSchema.parse({ checkIntervalMs: 60_000, defaultIntervalMs: 30_000 })
      .defaultIntervalMs,
  ).toBe(30_000);
});

test("intervals are bounded", () => {
  expect(() => configSchema.parse({ defaultIntervalMs: 999 })).toThrow();
  expect(() => configSchema.parse({ defaultIntervalMs: 86_400_001 })).toThrow();
  expect(() => configSchema.parse({ failureThreshold: 0 })).toThrow();
  expect(() =>
    configSchema.parse({ services: { a: { sloTarget: 101 } } }),
  ).toThrow();
});

test("a per-service interval overrides the default", () => {
  const config = configSchema.parse({
    defaultIntervalMs: 60_000,
    services: { slow: { intervalMs: 600_000 } },
  });
  expect(intervalFor(config, "slow")).toBe(600_000);
  expect(intervalFor(config, "other")).toBe(60_000);
});
