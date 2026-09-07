import { expect, test } from "bun:test";
import { ManualRefreshPolicy } from "./manual";
import type { RefreshPolicy } from "./policy";
import { PollingRefreshPolicy } from "./polling";

test("manual policy never schedules", () => {
  const policy: RefreshPolicy = new ManualRefreshPolicy();
  expect(policy.spec).toEqual({ kind: "manual" });
  expect(() => {
    policy.start(() => {
      throw new Error("must never be called");
    });
    policy.stop();
    policy.stop();
  }).not.toThrow();
});

test("polling policy reloads on its interval", async () => {
  const policy = new PollingRefreshPolicy(10);
  expect(policy.spec).toEqual({ kind: "poll", intervalMs: 10 });
  let calls = 0;
  policy.start(() => {
    calls++;
  });
  await new Promise((resolve) => setTimeout(resolve, 35));
  policy.stop();
  const frozen = calls;
  await new Promise((resolve) => setTimeout(resolve, 25));
  expect(calls).toBe(frozen);
  expect(calls).toBeGreaterThanOrEqual(2);
});

test("polling policy rejects invalid intervals", () => {
  expect(() => new PollingRefreshPolicy(0)).toThrow();
  expect(() => new PollingRefreshPolicy(-100)).toThrow();
  expect(() => new PollingRefreshPolicy(Number.NaN)).toThrow();
});
