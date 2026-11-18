import { expect, test } from "bun:test";
import { recordProbeResult } from "./engine.js";
import { activeOutage, listOutages } from "./outages.js";
import { readCheckTransitions, readRollups, readState } from "./repo.js";
import { HOUR_MS } from "./rollups.js";
import { SUMMARY_MAX } from "./signals.js";
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

const signalsOf = (outcomes: ReturnType<typeof feed>) =>
  outcomes.flatMap((outcome) => (outcome.signal ? [outcome.signal] : []));

test("a single failure is recorded but starts no outage and emits no signal", () => {
  const db = testDb();
  const outcomes = feed(db, ["healthy", "unavailable", "healthy"]);
  expect(signalsOf(outcomes)).toHaveLength(0);
  expect(listOutages(db, { serviceIds: ["db"] })).toHaveLength(0);
  expect(readState(db, "db")?.health).toBe("healthy");
});

test("sustained failure starts one outage and emits one signal", () => {
  const db = testDb();
  const signals = signalsOf(
    feed(db, ["healthy", "unavailable", "unavailable", "unavailable"]),
  );
  expect(signals).toHaveLength(1);
  const outage = activeOutage(db, "db");
  expect(outage).toMatchObject({ severity: "unavailable", endedAt: null });
  expect(signals[0]).toMatchObject({
    id: "service-unavailable",
    type: "error",
    serviceId: "db",
    payload: {
      previous: "healthy",
      current: "unavailable",
      serviceName: "Database",
      stateKey: outage?.id,
      startedAt: outage?.startedAt,
    },
  });
  expect(signals[0]?.payload.summary).toMatch(/^Database is down: /);
});

test("recovery ends the outage and emits a recovered signal", () => {
  const db = testDb();
  const outcomes = feed(db, ["unavailable", "healthy", "healthy"]);
  const last = outcomes.at(-1);
  expect(last?.signal).toMatchObject({
    id: "service-recovered",
    type: "success",
  });
  expect(last?.signal?.payload.summary).toMatch(/^Database recovered after \d/);
  expect(activeOutage(db, "db")).toBeNull();
  const [outage] = listOutages(db, { serviceIds: ["db"] });
  expect(outage?.endedAt).toBe(T0 + 2 * MIN);
});

test("every signal of one outage carries the same state key", () => {
  const db = testDb();
  const signals = signalsOf(
    feed(db, [
      "warning",
      "unavailable",
      "unavailable",
      "warning",
      "warning",
      "healthy",
      "healthy",
    ]),
  );
  expect(signals.map((signal) => signal.id)).toEqual([
    "service-degraded",
    "service-unavailable",
    "service-degraded",
    "service-recovered",
  ]);
  expect(new Set(signals.map((s) => s.payload.stateKey)).size).toBe(1);
  const [outage] = listOutages(db, { serviceIds: ["db"] });
  expect(outage).toMatchObject({
    severity: "warning",
    peakSeverity: "unavailable",
  });
});

test("a service that fails again soon after recovery continues the same outage", () => {
  const db = testDb();
  const signals = signalsOf(
    feed(db, [
      "unavailable",
      "healthy",
      "healthy",
      "unavailable",
      "unavailable",
    ]),
  );
  const outages = listOutages(db, { serviceIds: ["db"] });
  expect(outages).toHaveLength(1);
  expect(outages[0]?.endedAt).toBeNull();
  expect(signals.at(-1)?.payload.stateKey).toBe(signals[0]?.payload.stateKey);
});

test("a failure after the reopen window starts a new outage with a new key", () => {
  const db = testDb();
  const config = testConfig({ reopenWindowMinutes: 1 });
  const first = signalsOf(
    feed(db, ["unavailable", "healthy", "healthy"], { config }),
  );
  const second = signalsOf(
    feed(db, ["unavailable", "unavailable"], { config, start: T0 + 60 * MIN }),
  );
  expect(listOutages(db, { serviceIds: ["db"] })).toHaveLength(2);
  expect(second[0]?.payload.stateKey).not.toBe(first[0]?.payload.stateKey);
});

test("a silence suppresses outages and signals", () => {
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
  expect(signalsOf(outcomes)).toHaveLength(0);
  expect(listOutages(db, { serviceIds: ["db"] })).toHaveLength(0);
});

test("an outage starts when a silence ends while the service is still down", () => {
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

test("an unknown result keeps the last real checks and the current outage", () => {
  const db = testDb();
  const config = testConfig();
  recordProbeResult(
    db,
    config,
    svc,
    probe("db", "unavailable", {
      checks: [{ id: "a", label: "A", ok: false }],
    }),
    T0,
  );
  const outcome = recordProbeResult(
    db,
    config,
    svc,
    probe("db", "unknown"),
    T0 + MIN,
  );
  expect(outcome.signal).toBeNull();
  expect(readState(db, "db")?.lastChecks).toEqual([
    { id: "a", label: "A", ok: false },
  ]);
  expect(activeOutage(db, "db")).not.toBeNull();
});

test("rewriting a sample at the same time does not double count the rollup", () => {
  const db = testDb();
  const config = testConfig();
  recordProbeResult(db, config, svc, probe("db", "healthy"), T0);
  recordProbeResult(db, config, svc, probe("db", "unavailable"), T0);
  const bucket = readRollups(db, "db", "hour", T0, T0 + HOUR_MS).get(T0);
  expect(bucket).toMatchObject({ healthy: 0, unavailable: 1 });
});

test("the outage names failing checks and keeps the adapter's detail", () => {
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
  const outcome = recordProbeResult(db, config, svc, failing, T0);
  expect(activeOutage(db, "db")).toMatchObject({
    summary: "Service reachable failing",
    detail: "Service reachable: ECONNREFUSED 127.0.0.1:5432",
  });
  expect(outcome.signal?.payload.summary).toBe(
    "Database is down: Service reachable failing",
  );
});

test("a long summary is clipped for notification consumers", () => {
  const db = testDb();
  const config = testConfig();
  const checks = Array.from({ length: 40 }, (_, index) => ({
    id: `check-${index}`,
    label: `A rather long check label number ${index}`,
    ok: false,
  }));
  const outcome = recordProbeResult(
    db,
    config,
    svc,
    probe("db", "unavailable", { checks }),
    T0,
  );
  const summary = outcome.signal?.payload.summary ?? "";
  expect(summary.length).toBe(SUMMARY_MAX);
  expect(summary.endsWith("…")).toBe(true);
});
