import { expect, test } from "bun:test";
import { recordProbeResult } from "./engine.js";
import {
  acknowledgeIncident,
  activeIncident,
  listEvents,
  listIncidents,
  noteIncident,
  resolveIncident,
} from "./incidents.js";
import { readCheckTransitions, readRollups, readState } from "./repo.js";
import { HOUR_MS } from "./rollups.js";
import { createSuppression } from "./suppressions.js";
import { probe, service, testConfig, testDb } from "./testing.js";

const svc = service("db", "postgres", "Database");
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
const MIN = 60_000;

function feed(
  db: ReturnType<typeof testDb>,
  sequence: Array<"healthy" | "warning" | "unavailable" | "unknown">,
  options: { config?: ReturnType<typeof testConfig>; start?: number } = {},
) {
  const config = options.config ?? testConfig();
  return sequence.map((health, index) =>
    recordProbeResult(
      db,
      config,
      svc,
      probe("db", health, { latencyMs: 10 + index }),
      (options.start ?? T0) + index * MIN,
    ),
  );
}

test("a single failure is recorded but raises no incident or signal", () => {
  const db = testDb();
  const outcomes = feed(db, ["healthy", "unavailable", "healthy"]);
  expect(outcomes.every((outcome) => outcome.signal === null)).toBe(true);
  expect(listIncidents(db, { serviceIds: ["db"] })).toHaveLength(0);
  expect(readState(db, "db")?.health).toBe("healthy");
});

test("sustained failure opens one incident and emits one signal", () => {
  const db = testDb();
  const outcomes = feed(db, [
    "healthy",
    "unavailable",
    "unavailable",
    "unavailable",
  ]);
  const signals = outcomes.flatMap((outcome) =>
    outcome.signal ? [outcome.signal] : [],
  );
  expect(signals).toHaveLength(1);
  expect(signals[0]).toMatchObject({
    id: "service-unavailable",
    type: "error",
    serviceId: "db",
    payload: {
      previous: "healthy",
      current: "unavailable",
      serviceName: "Database",
    },
  });
  const incident = activeIncident(db, "db");
  expect(incident).toMatchObject({ status: "open", severity: "unavailable" });
  expect(listEvents(db, incident?.id ?? "").map((e) => e.kind)).toEqual([
    "opened",
  ]);
});

test("recovery resolves the incident and emits a recovered signal", () => {
  const db = testDb();
  const outcomes = feed(db, ["unavailable", "healthy", "healthy"]);
  const last = outcomes.at(-1);
  expect(last?.signal).toMatchObject({
    id: "service-recovered",
    type: "success",
  });
  expect(last?.signal?.payload.summary).toMatch(/^Recovered after \d/);
  expect(activeIncident(db, "db")).toBeNull();
  const [incident] = listIncidents(db, { serviceIds: ["db"] });
  expect(incident).toMatchObject({ status: "resolved", resolvedBy: null });
});

test("escalation and de-escalation update the incident and signal", () => {
  const db = testDb();
  const outcomes = feed(db, [
    "warning",
    "unavailable",
    "unavailable",
    "warning",
    "warning",
  ]);
  const ids = outcomes.flatMap((o) => (o.signal ? [o.signal.id] : []));
  expect(ids).toEqual([
    "service-degraded",
    "service-unavailable",
    "service-degraded",
  ]);
  const [incident] = listIncidents(db, { serviceIds: ["db"] });
  expect(incident).toMatchObject({
    severity: "warning",
    peakSeverity: "unavailable",
  });
  expect(listEvents(db, incident?.id ?? "").map((e) => e.kind)).toEqual([
    "opened",
    "escalated",
    "deescalated",
  ]);
});

test("a service that fails again soon after recovery reopens the same incident", () => {
  const db = testDb();
  feed(db, ["unavailable", "healthy", "healthy", "unavailable", "unavailable"]);
  const incidents = listIncidents(db, { serviceIds: ["db"] });
  expect(incidents).toHaveLength(1);
  expect(incidents[0]?.status).toBe("open");
  expect(listEvents(db, incidents[0]?.id ?? "").map((e) => e.kind)).toContain(
    "reopened",
  );
});

test("a failure after the reopen window starts a new incident", () => {
  const db = testDb();
  const config = testConfig({ reopenWindowMinutes: 1 });
  feed(db, ["unavailable", "healthy", "healthy"], { config });
  feed(db, ["unavailable", "unavailable"], { config, start: T0 + 60 * MIN });
  expect(listIncidents(db, { serviceIds: ["db"] })).toHaveLength(2);
});

test("a silence suppresses incidents and signals", () => {
  const db = testDb();
  createSuppression(
    db,
    {
      kind: "silence",
      serviceId: "db",
      startsAt: T0 - MIN,
      endsAt: T0 + 60 * MIN,
      createdBy: "test",
    },
    T0,
  );
  const outcomes = feed(db, ["healthy", "unavailable", "unavailable"]);
  expect(outcomes.every((o) => o.signal === null)).toBe(true);
  expect(listIncidents(db, { serviceIds: ["db"] })).toHaveLength(0);
});

test("an incident opens when a silence ends while the service is still down", () => {
  const db = testDb();
  createSuppression(
    db,
    {
      kind: "silence",
      serviceId: "db",
      startsAt: T0 - MIN,
      endsAt: T0 + 3 * MIN,
      createdBy: "test",
    },
    T0,
  );
  const outcomes = feed(db, [
    "unavailable",
    "unavailable",
    "unavailable",
    "unavailable",
    "unavailable",
  ]);
  expect(outcomes[2]?.signal).toBeNull();
  expect(outcomes[3]?.signal?.id).toBe("service-unavailable");
});

test("maintenance time is excluded from uptime", () => {
  const db = testDb();
  createSuppression(
    db,
    {
      kind: "maintenance",
      serviceId: null,
      startsAt: T0,
      endsAt: T0 + 2 * MIN,
      createdBy: "test",
    },
    T0,
  );
  feed(db, ["unavailable", "unavailable", "healthy", "healthy"]);
  const bucket = readRollups(db, "db", "hour", T0, T0 + HOUR_MS).get(T0);
  expect(bucket).toMatchObject({ maintenance: 2, healthy: 2, unavailable: 0 });
});

test("only changed checks are recorded as transitions", () => {
  const db = testDb();
  const checks = (ok: boolean) => [
    { id: "reachability", label: "Reachable", ok: true },
    { id: "disk", label: "Disk", ok, detail: ok ? "40%" : "95%" },
  ];
  const config = testConfig();
  for (const [index, ok] of [true, true, false, false, true].entries())
    recordProbeResult(
      db,
      config,
      svc,
      probe("db", ok ? "healthy" : "warning", { checks: checks(ok) }),
      T0 + index * MIN,
    );
  const changes = readCheckTransitions(db, "db", 0).map((c) => [
    c.checkId,
    c.ok,
  ]);
  expect(changes.sort()).toEqual([
    ["disk", false],
    ["disk", true],
  ]);
});

test("an unknown result keeps the last real checks for change detection", () => {
  const db = testDb();
  const config = testConfig();
  recordProbeResult(
    db,
    config,
    svc,
    probe("db", "healthy", { checks: [{ id: "a", label: "A", ok: true }] }),
    T0,
  );
  recordProbeResult(db, config, svc, probe("db", "unknown"), T0 + MIN);
  expect(readState(db, "db")?.lastChecks).toEqual([
    { id: "a", label: "A", ok: true },
  ]);
  expect(readState(db, "db")?.health).toBe("healthy");
});

test("acknowledging, noting and resolving record who did it", () => {
  const db = testDb();
  feed(db, ["unavailable", "unavailable"]);
  const incident = activeIncident(db, "db");
  const id = incident?.id ?? "";
  expect(acknowledgeIncident(db, id, "ana", T0).ok).toBe(true);
  expect(acknowledgeIncident(db, id, "ana", T0)).toEqual({
    ok: false,
    reason: "already-acknowledged",
  });
  expect(noteIncident(db, id, "ana", "Looking at it", T0).ok).toBe(true);
  expect(resolveIncident(db, id, "ana", "Restarted", T0 + MIN).ok).toBe(true);
  expect(resolveIncident(db, id, "ana", undefined, T0)).toEqual({
    ok: false,
    reason: "already-resolved",
  });
  expect(listEvents(db, id).map((e) => [e.kind, e.actor])).toEqual([
    ["opened", null],
    ["acknowledged", "ana"],
    ["note", "ana"],
    ["resolved", "ana"],
  ]);
});

test("resolving by hand holds off a new incident until the service has recovered", () => {
  const db = testDb();
  const config = testConfig();
  feed(db, ["unavailable", "unavailable"]);
  resolveIncident(
    db,
    activeIncident(db, "db")?.id ?? "",
    "ana",
    undefined,
    T0 + 2 * MIN,
  );
  feed(db, ["unavailable", "unavailable"], { config, start: T0 + 3 * MIN });
  expect(activeIncident(db, "db")).toBeNull();
  feed(db, ["healthy", "healthy", "unavailable", "unavailable"], {
    config,
    start: T0 + 10 * MIN,
  });
  expect(activeIncident(db, "db")).not.toBeNull();
});

test("rewriting a sample at the same time does not double count the rollup", () => {
  const db = testDb();
  const config = testConfig();
  recordProbeResult(db, config, svc, probe("db", "healthy"), T0);
  recordProbeResult(db, config, svc, probe("db", "unavailable"), T0);
  const bucket = readRollups(db, "db", "hour", T0, T0 + HOUR_MS).get(T0);
  expect(bucket).toMatchObject({ healthy: 0, unavailable: 1 });
});

test("the incident headline names failing checks and the timeline keeps the detail", () => {
  const db = testDb();
  const config = testConfig();
  const failing = probe("db", "unavailable", {
    checks: [
      {
        id: "reachability",
        label: "Service reachable",
        ok: false,
        detail: "ECONNREFUSED 127.0.0.1:5432",
      },
      { id: "version", label: "Version", ok: true },
    ],
  });
  recordProbeResult(db, config, svc, failing, T0);
  const incident = activeIncident(db, "db");
  expect(incident?.summary).toBe("Service reachable failing");
  expect(listEvents(db, incident?.id ?? "")[0]?.message).toBe(
    "Service reachable: ECONNREFUSED 127.0.0.1:5432",
  );
});
