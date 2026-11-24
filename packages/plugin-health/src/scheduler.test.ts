import { expect, test } from "bun:test";
import type { Probe } from "./context.js";
import {
  jitterMs,
  nextDueAt,
  probeWithBudget,
  selectDue,
} from "./scheduler.js";
import { service } from "./testing.js";

test("jitter is deterministic and within ten percent", () => {
  for (const id of ["a", "warehouse", "service-42", "x".repeat(40)]) {
    const value = jitterMs(id, 60_000);
    expect(value).toBe(jitterMs(id, 60_000));
    expect(Math.abs(value)).toBeLessThanOrEqual(6_000);
  }
  expect(nextDueAt("a", 1_000, 60_000)).toBe(
    1_000 + 60_000 + jitterMs("a", 60_000),
  );
});

test("jitter spreads a fleet instead of aligning it", () => {
  const offsets = new Set(
    Array.from({ length: 50 }, (_, i) => jitterMs(`service-${i}`, 60_000)),
  );
  expect(offsets.size).toBeGreaterThan(30);
});

test("selectDue returns unseen services first, then the most overdue", () => {
  const services = ["a", "b", "c", "d"].map((id) => service(id));
  const due = selectDue(
    services,
    new Map([
      ["a", 900],
      ["b", 100],
      ["c", 5_000],
    ]),
    1_000,
  );
  expect(due.map((item) => item.id)).toEqual(["d", "b", "a"]);
});

function deferred() {
  let resolve!: (value: Probe) => void;
  const promise = new Promise<Probe>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test("probes stay within the global and per-adapter budget", async () => {
  const services = [
    ...["p1", "p2", "p3", "p4"].map((id) => service(id, "postgres")),
    ...["c1", "c2", "c3"].map((id) => service(id, "clickhouse")),
  ];
  let active = 0;
  let peak = 0;
  const perAdapter = new Map<string, number>();
  let peakAdapter = 0;
  const outcomes: string[] = [];
  await probeWithBudget(
    services,
    async (id) => {
      const adapter = services.find((s) => s.id === id)?.adapter ?? "";
      active++;
      peak = Math.max(peak, active);
      perAdapter.set(adapter, (perAdapter.get(adapter) ?? 0) + 1);
      peakAdapter = Math.max(peakAdapter, perAdapter.get(adapter) ?? 0);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      perAdapter.set(adapter, (perAdapter.get(adapter) ?? 1) - 1);
      return { id, health: "healthy" };
    },
    { maxConcurrent: 3, maxPerAdapter: 2 },
    ({ service: s }) => {
      outcomes.push(s.id);
    },
  );
  expect(outcomes.sort()).toEqual(["c1", "c2", "c3", "p1", "p2", "p3", "p4"]);
  expect(peak).toBeLessThanOrEqual(3);
  expect(peakAdapter).toBeLessThanOrEqual(2);
});

test("a hanging adapter does not delay services on other adapters", async () => {
  const slow = [service("s1", "slow"), service("s2", "slow")];
  const fast = [service("f1", "fast"), service("f2", "fast")];
  const gate = deferred();
  const done: string[] = [];
  const run = probeWithBudget(
    [...slow, ...fast],
    (id) =>
      id.startsWith("s")
        ? gate.promise
        : Promise.resolve({ id, health: "healthy" as const }),
    { maxConcurrent: 4, maxPerAdapter: 1 },
    ({ service: s }) => {
      done.push(s.id);
    },
  );
  await new Promise((r) => setTimeout(r, 20));
  expect(done.sort()).toEqual(["f1", "f2"]);
  gate.resolve({ id: "s1", health: "healthy" });
  await run;
  expect(done).toContain("s1");
});

test("a probe that throws is reported as unavailable, not rejected", async () => {
  const seen: Array<[string, string | undefined]> = [];
  await probeWithBudget(
    [service("boom")],
    () => Promise.reject(new Error("nope")),
    { maxConcurrent: 1, maxPerAdapter: 1 },
    ({ service: s, probe }) => {
      seen.push([s.id, probe?.health]);
    },
  );
  expect(seen).toEqual([["boom", "unavailable"]]);
});

test("an aborted run starts no further probes", async () => {
  const controller = new AbortController();
  const started: string[] = [];
  await probeWithBudget(
    ["a", "b", "c"].map((id) => service(id)),
    async (id) => {
      started.push(id);
      controller.abort();
      return { id, health: "healthy" };
    },
    { maxConcurrent: 1, maxPerAdapter: 1 },
    () => undefined,
    controller.signal,
  );
  expect(started).toEqual(["a"]);
});
