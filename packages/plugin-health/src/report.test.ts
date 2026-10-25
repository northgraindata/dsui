import { expect, test } from "bun:test";
import { weeklyPayload } from "./digest.js";
import { recordProbeResult } from "./engine.js";
import { resolveIncident } from "./incidents.js";
import { buildReport, summaryLine } from "./report.js";
import { DAY_MS } from "./rollups.js";
import { weeklyReportPayloadSchema } from "./signals.js";
import { probe, service, testConfig, testDb } from "./testing.js";

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);
const config = testConfig();
const a = service("a", "postgres", "Alpha");
const b = service("b", "airflow", "Bravo");

function feed(
  db: ReturnType<typeof testDb>,
  svc: typeof a,
  daysAgo: number,
  results: Array<"healthy" | "unavailable">,
) {
  for (const [index, health] of results.entries())
    recordProbeResult(
      db,
      config,
      svc,
      probe(svc.id, health),
      NOW - daysAgo * DAY_MS + index * 60_000,
    );
}

test("the report compares this period with the one before it", () => {
  const db = testDb();
  // Previous week: a is fine. This week: a fails half the time.
  feed(db, a, 10, ["healthy", "healthy", "healthy", "healthy"]);
  feed(db, a, 2, ["healthy", "healthy", "unavailable", "unavailable"]);
  feed(db, b, 10, ["healthy", "healthy"]);
  feed(db, b, 2, ["healthy", "healthy"]);
  const report = buildReport(db, [a, b], 7, NOW);
  expect(report.current.availability).toBeCloseTo((4 / 6) * 100, 5);
  expect(report.previous.availability).toBe(100);
  expect(report.services.map((s) => s.id)).toEqual(["a", "b"]);
  expect(report.services[0]).toMatchObject({
    availability: 50,
    previousAvailability: 100,
  });
});

test("services with no data sort last and do not drag the average", () => {
  const db = testDb();
  feed(db, a, 1, ["healthy", "healthy"]);
  const report = buildReport(db, [b, a], 7, NOW);
  expect(report.services.map((s) => s.id)).toEqual(["a", "b"]);
  expect(report.services[1]?.availability).toBeNull();
  expect(report.current.availability).toBe(100);
});

test("incidents are counted in the period they opened and resolved in", () => {
  const db = testDb();
  feed(db, a, 10, ["unavailable", "unavailable"]);
  feed(db, a, 9, ["healthy", "healthy"]);
  feed(db, a, 2, ["unavailable", "unavailable"]);
  const [open] = db
    .query<{ id: string }, []>(
      "SELECT id FROM incidents WHERE resolved_at IS NULL",
    )
    .all();
  resolveIncident(db, open?.id ?? "", "ana", undefined, NOW - DAY_MS);
  const report = buildReport(db, [a], 7, NOW);
  expect(report.current.incidentsOpened).toBe(1);
  expect(report.current.incidentsResolved).toBe(1);
  expect(report.previous.incidentsOpened).toBe(1);
  expect(report.previous.incidentsResolved).toBe(1);
  expect(report.current.meanTimeToResolveMs).toBeGreaterThan(0);
});

test("a thirty day report reads daily rollups", () => {
  const db = testDb();
  feed(db, a, 20, ["healthy", "healthy"]);
  feed(db, a, 45, ["unavailable", "unavailable"]);
  const report = buildReport(db, [a], 30, NOW);
  expect(report.current.availability).toBe(100);
  expect(report.previous.availability).toBe(0);
});

test("the summary line is readable and notes the lowest service", () => {
  const db = testDb();
  feed(db, a, 2, ["healthy", "unavailable", "unavailable"]);
  const line = summaryLine(buildReport(db, [a], 7, NOW));
  expect(line).toContain("Last 7 days: 33.33% uptime");
  expect(line).toContain("1 incident");
  expect(line).toContain("lowest: Alpha at 33.33%");
});

test("the weekly payload matches its schema and carries a summary", () => {
  const db = testDb();
  feed(db, a, 1, ["healthy", "healthy"]);
  const payload = weeklyPayload(
    { storage: { openDatabase: () => db } as never },
    [a],
    NOW,
  );
  expect(weeklyReportPayloadSchema.parse(payload)).toEqual(payload);
  expect(payload.summary.length).toBeGreaterThan(10);
  expect(payload.lowest[0]?.id).toBe("a");
});
