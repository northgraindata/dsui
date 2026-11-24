import { expect, test } from "bun:test";
import { fleetSchema, serviceDetailSchema } from "./contract.js";
import { recordProbeResult } from "./engine.js";
import { readRollups } from "./repo.js";
import { HOUR_MS } from "./rollups.js";
import { createSuppression } from "./suppressions.js";
import { probe, service, testConfig, testDb } from "./testing.js";
import {
  buildFleet,
  buildServiceDetail,
  buildStrip,
  STRIP_HOURS,
} from "./view.js";

const NOW = Date.UTC(2026, 5, 1, 12, 30);
const config = testConfig();

test("a service that was never checked reads as unknown with an empty strip", () => {
  const db = testDb();
  const fleet = buildFleet(db, [service("a")], NOW);
  expect(fleetSchema.parse(fleet)).toEqual(fleet);
  expect(fleet.items[0]).toMatchObject({
    health: "unknown",
    lastCheckedAt: null,
    outageId: null,
  });
  expect(fleet.items[0]?.strip).toHaveLength(STRIP_HOURS);
  expect(fleet.items[0]?.strip.every((bucket) => bucket.health === null)).toBe(
    true,
  );
  expect(fleet.availability7d).toBeNull();
});

test("the fleet reports counts, the ongoing outage and the worst status per hour", () => {
  const db = testDb();
  const a = service("a");
  const b = service("b");
  recordProbeResult(
    db,
    config,
    a,
    probe("a", "healthy", { latencyMs: 12 }),
    NOW - 5 * 60_000,
  );
  recordProbeResult(db, config, b, probe("b", "healthy"), NOW - 5 * 60_000);
  recordProbeResult(db, config, b, probe("b", "unavailable"), NOW - 2 * 60_000);
  recordProbeResult(db, config, b, probe("b", "unavailable"), NOW - 60_000);
  const fleet = buildFleet(db, [a, b], NOW);
  expect(fleet.counts).toEqual({
    healthy: 1,
    warning: 0,
    unavailable: 1,
    unknown: 0,
  });
  expect(fleet.activeOutages).toBe(1);
  const strip = fleet.items.find((item) => item.id === "b")?.strip.at(-1);
  expect(strip).toMatchObject({ health: "unavailable", samples: 3 });
  expect(fleet.items.find((item) => item.id === "b")?.outageId).not.toBeNull();
});

test("the fleet only includes the services it is given", () => {
  const db = testDb();
  recordProbeResult(
    db,
    config,
    service("hidden"),
    probe("hidden", "unavailable"),
    NOW - 1000,
  );
  const fleet = buildFleet(db, [service("a")], NOW);
  expect(fleet.items.map((item) => item.id)).toEqual(["a"]);
  expect(fleet.activeOutages).toBe(0);
});

test("a maintenance hour shows as maintenance, not as downtime", () => {
  const db = testDb();
  createSuppression(
    db,
    {
      kind: "maintenance",
      serviceId: "a",
      startsAt: NOW - HOUR_MS,
      endsAt: NOW + HOUR_MS,
      createdBy: "t",
    },
    NOW - HOUR_MS,
  );
  recordProbeResult(
    db,
    config,
    service("a"),
    probe("a", "unavailable"),
    NOW - 1000,
  );
  const fleet = buildFleet(db, [service("a")], NOW);
  expect(fleet.items[0]?.strip.at(-1)?.health).toBe("maintenance");
  expect(fleet.items[0]?.maintenance).toBe(true);
  expect(fleet.items[0]?.availability7d).toBeNull();
});

test("service detail matches its contract and includes ranges, strips and checks", () => {
  const db = testDb();
  const a = service("a");
  recordProbeResult(
    db,
    config,
    a,
    probe("a", "healthy", {
      latencyMs: 20,
      score: 100,
      checks: [{ id: "r", label: "Reachable", ok: true }],
    }),
    NOW - 60_000,
  );
  const detail = buildServiceDetail(
    db,
    testConfig({ services: { a: { sloTarget: 99.9 } } }),
    a,
    new Map([["a", a]]),
    NOW,
  );
  expect(serviceDetailSchema.parse(detail)).toEqual(detail);
  expect(detail.ranges.map((range) => range.days)).toEqual([1, 7, 30, 90]);
  expect(detail.state?.checks).toEqual([
    { id: "r", label: "Reachable", ok: true },
  ]);
  expect(detail.slo?.budget.met).toBe(true);
  expect(detail.strip).toHaveLength(STRIP_HOURS);
  expect(detail.daily).toHaveLength(90);
});

test("a strip always has the requested length and ends at the current bucket", () => {
  const db = testDb();
  recordProbeResult(db, config, service("a"), probe("a", "healthy"), NOW);
  const rollups = readRollups(db, "a", "hour", NOW - 10 * HOUR_MS, NOW);
  const strip = buildStrip(rollups, NOW, "hour", 24);
  expect(strip).toHaveLength(24);
  expect(strip.at(-1)?.time).toBe(Math.floor(NOW / HOUR_MS) * HOUR_MS);
  expect(strip.at(-1)?.health).toBe("healthy");
});

test("service detail lists outages of the last ninety days, newest first", () => {
  const db = testDb();
  const a = service("a");
  const DAY = 24 * HOUR_MS;
  for (const [start, results] of [
    [NOW - 120 * DAY, ["unavailable", "healthy"]],
    [NOW - 20 * DAY, ["warning", "healthy"]],
    [NOW - 60_000, ["unavailable"]],
  ] as const)
    for (const [index, health] of results.entries())
      recordProbeResult(
        db,
        testConfig({ failureThreshold: 1, recoveryThreshold: 1 }),
        a,
        probe("a", health),
        start + index * HOUR_MS,
      );
  const detail = buildServiceDetail(db, config, a, new Map([["a", a]]), NOW);
  expect(serviceDetailSchema.parse(detail)).toEqual(detail);
  expect(
    detail.outages.map((outage) => [outage.peakSeverity, outage.endedAt]),
  ).toEqual([
    ["unavailable", null],
    ["warning", NOW - 20 * DAY + HOUR_MS],
  ]);
});

test("only plain workspace paths survive on a check", () => {
  const db = testDb();
  const a = service("a");
  recordProbeResult(
    db,
    config,
    a,
    probe("a", "warning", {
      checks: [
        { id: "good", label: "Good", ok: false, href: "/dags" },
        { id: "bad", label: "Bad", ok: false, href: "https://evil.example" },
      ],
    }),
    NOW,
  );
  const detail = buildServiceDetail(db, config, a, new Map([["a", a]]), NOW);
  const checks = new Map(
    detail.state?.checks.map((check) => [check.id, check]),
  );
  expect(checks.get("good")?.href).toBe("/dags");
  expect(checks.get("bad")?.href).toBeUndefined();
});
