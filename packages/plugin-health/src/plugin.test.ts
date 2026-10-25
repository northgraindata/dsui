import { expect, test } from "bun:test";
import { emitWeeklyReport } from "./digest.js";
import { recordProbeResult } from "./engine.js";
import { createHealthPlugin } from "./plugin.js";
import { weeklyReportPayloadSchema } from "./signals.js";
import { probe, service, testConfig, testDb } from "./testing.js";

type Registered = {
  jobs: Array<{ id: string; schedule?: string; intervalMs?: number }>;
  resources: string[];
  actions: string[];
  signals: string[];
  pages: string[];
  slots: string[];
  procedures: string[];
};

function register(): Registered {
  const registered: Registered = {
    jobs: [],
    resources: [],
    actions: [],
    signals: [],
    pages: [],
    slots: [],
    procedures: [],
  };
  const plugin = createHealthPlugin();
  plugin.setup(
    {
      job: (job: { id: string; schedule?: string; intervalMs?: number }) =>
        registered.jobs.push(job),
      resource: (item: { id: string }) => registered.resources.push(item.id),
      action: (item: { id: string }) => registered.actions.push(item.id),
      signal: (item: { id: string }) => registered.signals.push(item.id),
      page: (_page: unknown, options: { id: string }) =>
        registered.pages.push(options.id),
      slot: (item: { id: string }) => registered.slots.push(item.id),
      procedure: (item: { id: string }) => registered.procedures.push(item.id),
      navigation: () => undefined,
    } as never,
    testConfig(),
  );
  return registered;
}

test("the plugin registers its jobs, signals, resources, actions and pages", () => {
  const registered = register();
  expect(registered.jobs.map((job) => job.id).sort()).toEqual([
    "scheduler",
    "weekly-report",
  ]);
  expect(registered.signals.sort()).toEqual([
    "service-degraded",
    "service-recovered",
    "service-unavailable",
    "weekly-report",
  ]);
  expect(registered.resources.sort()).toEqual([
    "incident-detail",
    "incidents",
    "report",
    "service-detail",
    "service-health",
    "suppressions",
  ]);
  expect(registered.actions).toContain("check-now");
  expect(registered.pages.sort()).toEqual([
    "incident",
    "incidents",
    "overview",
    "service",
    "settings",
  ]);
  expect(registered.slots.sort()).toEqual([
    "service-card-status",
    "service-workspace-status",
  ]);
});

test("ids are unique within each kind", () => {
  const registered = register();
  for (const ids of [
    registered.jobs.map((job) => job.id),
    registered.resources,
    registered.actions,
    registered.signals,
    registered.pages,
  ])
    expect(new Set(ids).size).toBe(ids.length);
});

test("the weekly report is a cron job and the scheduler is an interval job", () => {
  const { jobs } = register();
  expect(jobs.find((job) => job.id === "weekly-report")?.schedule).toBe(
    "0 8 * * 1",
  );
  expect(jobs.find((job) => job.id === "scheduler")?.intervalMs).toBe(15_000);
});

test("the weekly report is emitted as an info signal with a readable summary", async () => {
  const db = testDb();
  const config = testConfig();
  const a = service("a");
  recordProbeResult(db, config, a, probe("a", "healthy"), Date.now() - 60_000);
  const emitted: unknown[][] = [];
  const payload = await emitWeeklyReport({
    config,
    storage: { openDatabase: () => db } as never,
    services: { list: async () => ({ items: [a] }) } as never,
    events: {
      emit: async (...args: unknown[]) => {
        emitted.push(args);
      },
    } as never,
  });
  expect(emitted).toHaveLength(1);
  const [id, sent, serviceId, type] = emitted[0] ?? [];
  expect([id, serviceId, type]).toEqual(["weekly-report", undefined, "info"]);
  expect(weeklyReportPayloadSchema.parse(sent)).toEqual(payload);
  expect(payload.summary).toContain("Last 7 days");
});
