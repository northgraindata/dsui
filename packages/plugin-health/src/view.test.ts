import { expect, test } from "bun:test";
import { recordActivity } from "./activity.js";
import {
  fleetSchema,
  incidentDetailSchema,
  serviceDetailSchema,
} from "./contract.js";
import { recordProbeResult } from "./engine.js";
import { listIncidents } from "./incidents.js";
import { readRollups } from "./repo.js";
import { HOUR_MS } from "./rollups.js";
import { createSuppression } from "./suppressions.js";
import { probe, service, testConfig, testDb } from "./testing.js";
import {
  buildFleet,
  buildIncidentDetail,
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
    incidentId: null,
  });
  expect(fleet.items[0]?.strip).toHaveLength(STRIP_HOURS);
  expect(fleet.items[0]?.strip.every((bucket) => bucket.health === null)).toBe(
    true,
  );
  expect(fleet.availability7d).toBeNull();
});

test("the fleet reports counts, the active incident and the worst status per hour", () => {
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
  expect(fleet.activeIncidents).toBe(1);
  const strip = fleet.items.find((item) => item.id === "b")?.strip.at(-1);
  expect(strip).toMatchObject({ health: "unavailable", samples: 3 });
  expect(
    fleet.items.find((item) => item.id === "b")?.incidentId,
  ).not.toBeNull();
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
  expect(fleet.activeIncidents).toBe(0);
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

test("an incident lists signals from shortly before and after it opened", () => {
  const db = testDb();
  const a = service("a");
  recordProbeResult(db, config, a, probe("a", "unavailable"), NOW);
  const incident = listIncidents(db, { serviceIds: ["a"] })[0];
  const opened = incident?.openedAt ?? NOW;
  for (const [signalId, minutes] of [
    ["code-repository.updated", -30],
    ["dbt.run-failed", -5],
    ["airflow.dag-run-failed", 2],
    ["too.old", -120],
    ["too.late", 30],
  ] as const)
    recordActivity(db, {
      serviceId: "a",
      signalId,
      type: "error",
      time: opened + minutes * 60_000,
      summary: null,
    });
  recordActivity(db, {
    serviceId: "other",
    signalId: "elsewhere.signal",
    type: "error",
    time: opened - 60_000,
    summary: null,
  });
  const detail = buildIncidentDetail(
    db,
    incident as NonNullable<typeof incident>,
    new Map([["a", a]]),
    NOW,
  );
  expect(incidentDetailSchema.parse(detail)).toEqual(detail);
  expect(
    detail.around.map((entry) => [entry.signalId, entry.offsetMs]),
  ).toEqual([
    ["code-repository.updated", -30 * 60_000],
    ["dbt.run-failed", -5 * 60_000],
    ["airflow.dag-run-failed", 2 * 60_000],
  ]);
});

test("service detail lists recent activity newest first", () => {
  const db = testDb();
  const a = service("a");
  for (const [signalId, minutes] of [
    ["first", -50],
    ["second", -10],
  ] as const)
    recordActivity(db, {
      serviceId: "a",
      signalId,
      type: "info",
      time: NOW + minutes * 60_000,
      summary: null,
    });
  const detail = buildServiceDetail(db, config, a, new Map([["a", a]]), NOW);
  expect(detail.activity.map((entry) => entry.signalId)).toEqual([
    "second",
    "first",
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
