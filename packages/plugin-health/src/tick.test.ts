import { expect, test } from "bun:test";
import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
import { openHealthDb } from "./db.js";
import { readState } from "./repo.js";
import { SIGNALS } from "./signals.js";
import { probe, service, testConfig, testDb } from "./testing.js";
import { runTick, type TickContext } from "./tick.js";
import { buildFleet } from "./view.js";

const noop = () => undefined;

function harness(
  services: ReturnType<typeof service>[],
  health: Record<string, "healthy" | "unavailable"> = {},
  configOverrides: Record<string, unknown> = {},
) {
  const db = testDb();
  const probes: string[] = [];
  const emitted: Array<{ id: string; serviceId?: string }> = [];
  const storage = { openDatabase: () => db } as unknown as PluginStorage;
  const context: TickContext = {
    config: testConfig({ defaultIntervalMs: 60_000, ...configOverrides }),
    storage,
    services: {
      list: async () => ({
        items: services.map((s) => ({ ...s })),
      }),
      probe: async (id: string) => {
        probes.push(id);
        return probe(id, health[id] ?? "healthy", { latencyMs: 5 });
      },
    } as unknown as TickContext["services"],
    events: {
      emit: async (id: string, _payload: unknown, serviceId?: string) => {
        emitted.push({ id, ...(serviceId ? { serviceId } : {}) });
      },
    } as unknown as TickContext["events"],
    logger: { info: noop, warn: noop, error: noop },
  };
  return { db, context, probes, emitted, health };
}

test("the first tick probes every service and the next one probes none", async () => {
  const { context, probes } = harness([service("a"), service("b")]);
  let now = 1_000_000;
  expect((await runTick(context, { now: () => now })).checked).toBe(2);
  now += 5_000;
  expect((await runTick(context, { now: () => now })).checked).toBe(0);
  expect(probes).toEqual(["a", "b"]);
});

test("a service is probed again once its interval has passed", async () => {
  const { context, probes } = harness([service("a")]);
  let now = 1_000_000;
  await runTick(context, { now: () => now });
  now += 60_000 * 1.2;
  await runTick(context, { now: () => now });
  expect(probes).toEqual(["a", "a"]);
});

test("per-service intervals override the default", async () => {
  const { context, probes } = harness(
    [service("fast"), service("slow")],
    {},
    {
      services: {
        fast: { intervalMs: 10_000 },
        slow: { intervalMs: 3_600_000 },
      },
    },
  );
  let now = 1_000_000;
  await runTick(context, { now: () => now });
  now += 15_000;
  await runTick(context, { now: () => now });
  expect(probes).toEqual(["fast", "slow", "fast"]);
});

test("reading the fleet never probes", async () => {
  const { db, context, probes } = harness([service("a")]);
  await runTick(context, { now: () => 1_000_000 });
  const before = probes.length;
  for (let i = 0; i < 20; i++) buildFleet(db, [service("a")], 1_000_000);
  expect(probes.length).toBe(before);
});

test("an outage emits one signal after the failure threshold", async () => {
  const { context, emitted, health } = harness([service("a")]);
  let now = 1_000_000;
  const tick = async () => {
    await runTick(context, { now: () => now });
    now += 120_000;
  };
  await tick();
  health.a = "unavailable";
  await tick();
  expect(emitted).toEqual([]);
  await tick();
  await tick();
  expect(emitted).toEqual([{ id: SIGNALS.unavailable.id, serviceId: "a" }]);
  health.a = "healthy";
  await tick();
  await tick();
  expect(emitted.map((e) => e.id)).toEqual([
    SIGNALS.unavailable.id,
    SIGNALS.recovered.id,
  ]);
});

test("a manual run checks only the given services and ignores their schedule", async () => {
  const { context, probes } = harness([service("a"), service("b")]);
  await runTick(context, { now: () => 1_000_000 });
  await runTick(context, { now: () => 1_000_100, only: [service("b")] });
  expect(probes).toEqual(["a", "b", "b"]);
});

test("a failing signal emit does not stop the run or lose the result", async () => {
  const { db, context } = harness([service("a")], { a: "unavailable" });
  context.events.emit = async () => {
    throw new Error("bus down");
  };
  const clock = { now: 1_000_000 };
  for (let i = 0; i < 3; i++) {
    await runTick(context, { now: () => clock.now });
    clock.now += 120_000;
  }
  expect(readState(db, "a")?.health).toBe("unavailable");
});

test("openHealthDb caches the handle per storage", () => {
  const db = testDb();
  let opens = 0;
  const storage = {
    openDatabase: () => {
      opens++;
      return db;
    },
  } as unknown as PluginStorage;
  expect(openHealthDb(storage)).toBe(openHealthDb(storage));
  expect(opens).toBe(1);
});
