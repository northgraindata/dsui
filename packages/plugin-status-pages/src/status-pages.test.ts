import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { statusPageDetailSchema, statusPageListSchema } from "./contract.js";
import { applyMigrations } from "./db.js";
import type { HealthData } from "./health-data.js";
import { DAY_MS } from "./health-data.js";
import {
  createPage,
  deletePage,
  getPage,
  listComponents,
  listNotices,
  listUpdates,
  postNotice,
  StatusPageError,
  statusFromHealth,
  updateNotice,
  updatePage,
} from "./status-pages.js";
import {
  buildStatusPageList,
  buildStatusPageDetail as detail,
  noticeServiceIds,
} from "./status-view.js";

const snapshots = new WeakMap<Database, HealthData>();
function testDb() {
  const db = applyMigrations(new Database(":memory:"));
  snapshots.set(db, { version: 1, services: [] });
  return db;
}
const buildStatusPageDetail = (
  db: Database,
  page: Parameters<typeof detail>[1],
  can: Parameters<typeof detail>[2],
  now: number,
) => detail(db, page, can, now, snapshots.get(db));

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);
const MIN = 60_000;

function financePage(db: ReturnType<typeof testDb>) {
  return createPage(
    db,
    {
      slug: "finance",
      name: "Finance reporting",
      components: [
        { name: "Warehouse", serviceIds: ["wh"] },
        { name: "Dashboards", serviceIds: ["pg", "ch"] },
      ],
    },
    "ana",
    NOW,
  );
}

function record(
  db: ReturnType<typeof testDb>,
  id: string,
  health: "healthy" | "warning" | "unavailable",
  time = NOW,
) {
  const snapshot = snapshots.get(db)!;
  let service = snapshot.services.find((service) => service.id === id);
  if (!service) {
    service = { id, health, maintenance: false, days: [] };
    snapshot.services.push(service);
  }
  service.health = health;
  const bucket = Math.floor(time / DAY_MS) * DAY_MS;
  let day = service.days.find((day) => day.time === bucket);
  if (!day) {
    day = {
      time: bucket,
      healthy: 0,
      warning: 0,
      unavailable: 0,
      unknown: 0,
      maintenance: 0,
    };
    service.days.push(day);
  }
  day[health] += 1;
}

test("a component's status follows the worst of its services", () => {
  expect(statusFromHealth(["healthy", "healthy"], false)).toBe("operational");
  expect(statusFromHealth(["healthy", "warning"], false)).toBe("degraded");
  expect(statusFromHealth(["healthy", "unavailable"], false)).toBe(
    "partial-outage",
  );
  expect(statusFromHealth(["unavailable", "unavailable"], false)).toBe(
    "major-outage",
  );
  expect(statusFromHealth(["healthy"], true)).toBe("maintenance");
  expect(statusFromHealth([null, "unknown"], false)).toBe("unknown");
});

test("the page shows component status from recorded health and never probes", () => {
  const db = testDb();
  const page = financePage(db);
  record(db, "wh", "healthy");
  record(db, "pg", "healthy");
  record(db, "ch", "unavailable");
  const detail = buildStatusPageDetail(
    db,
    page,
    { edit: true, post: true },
    NOW,
  );
  expect(statusPageDetailSchema.parse(detail)).toEqual(detail);
  expect(detail.components.map((c) => [c.name, c.status])).toEqual([
    ["Warehouse", "operational"],
    ["Dashboards", "partial-outage"],
  ]);
  expect(detail.status).toBe("partial-outage");
  expect(detail.components[0]?.days).toHaveLength(90);
  expect(detail.components[0]?.days.at(-1)).toMatchObject({
    status: "operational",
    availability: 100,
  });
});

test("maintenance on a service shows the component as under maintenance", () => {
  const db = testDb();
  const page = financePage(db);
  record(db, "wh", "healthy");
  snapshots.get(db)!.services[0]!.maintenance = true;
  const detail = buildStatusPageDetail(
    db,
    page,
    { edit: false, post: false },
    NOW,
  );
  expect(detail.components[0]?.status).toBe("maintenance");
});

test("an open notice raises its components to its impact until it is resolved", () => {
  const db = testDb();
  const page = financePage(db);
  for (const id of ["wh", "pg", "ch"]) record(db, id, "healthy");
  const [warehouse] = listComponents(db, page.id);
  const notice = postNotice(
    db,
    {
      pageId: page.id,
      title: "Late loads",
      impact: "degraded",
      status: "investigating",
      message: "Nightly loads are running late.",
      componentIds: [warehouse?.id ?? ""],
    },
    "ana",
    NOW,
  );
  let detail = buildStatusPageDetail(db, page, { edit: true, post: true }, NOW);
  expect(detail.components.map((c) => c.status)).toEqual([
    "degraded",
    "operational",
  ]);
  expect(detail.active.map((n) => n.title)).toEqual(["Late loads"]);

  updateNotice(
    db,
    notice.id,
    { status: "resolved", message: "Loads caught up." },
    "ana",
    NOW + 30 * MIN,
  );
  detail = buildStatusPageDetail(
    db,
    page,
    { edit: true, post: true },
    NOW + 31 * MIN,
  );
  expect(detail.status).toBe("operational");
  expect(detail.active).toHaveLength(0);
  expect(detail.history[0]?.updates.map((u) => u.status)).toEqual([
    "resolved",
    "investigating",
  ]);
});

test("a resolved notice cannot be updated again", () => {
  const db = testDb();
  const page = financePage(db);
  const notice = postNotice(
    db,
    {
      pageId: page.id,
      title: "x",
      impact: "major-outage",
      status: "investigating",
      message: "m",
      componentIds: [],
    },
    "ana",
    NOW,
  );
  updateNotice(
    db,
    notice.id,
    { status: "resolved", message: "ok" },
    "ana",
    NOW,
  );
  expect(() =>
    updateNotice(
      db,
      notice.id,
      { status: "monitoring", message: "again" },
      "ana",
      NOW,
    ),
  ).toThrow(StatusPageError);
  expect(listUpdates(db, notice.id)).toHaveLength(2);
});

test("a notice can only name components of its own page", () => {
  const db = testDb();
  const page = financePage(db);
  const other = createPage(
    db,
    {
      slug: "other",
      name: "Other",
      components: [{ name: "A", serviceIds: ["a"] }],
    },
    "ana",
    NOW,
  );
  const [foreign] = listComponents(db, other.id);
  expect(() =>
    postNotice(
      db,
      {
        pageId: page.id,
        title: "x",
        impact: "degraded",
        status: "investigating",
        message: "m",
        componentIds: [foreign?.id ?? ""],
      },
      "ana",
      NOW,
    ),
  ).toThrow("A notice can only name components of its own page");
});

test("editing a page keeps component ids, so notices stay attached", () => {
  const db = testDb();
  const page = financePage(db);
  const [warehouse, dashboards] = listComponents(db, page.id);
  updatePage(
    db,
    page.id,
    {
      slug: "finance",
      name: "Finance",
      components: [
        { id: dashboards?.id, name: "Dashboards", serviceIds: ["pg"] },
        { id: warehouse?.id, name: "Data warehouse", serviceIds: ["wh"] },
        { name: "New thing", serviceIds: ["x"] },
      ],
    },
    NOW,
  );
  const after = listComponents(db, page.id);
  expect(after.map((c) => [c.name, c.position])).toEqual([
    ["Dashboards", 0],
    ["Data warehouse", 1],
    ["New thing", 2],
  ]);
  expect(after[0]?.id).toBe(dashboards?.id ?? "");
  expect(after[1]?.id).toBe(warehouse?.id ?? "");
  expect(after[0]?.serviceIds).toEqual(["pg"]);
});

test("addresses must be valid and unique", () => {
  const db = testDb();
  financePage(db);
  expect(() =>
    createPage(
      db,
      { slug: "finance", name: "Again", components: [] },
      "ana",
      NOW,
    ),
  ).toThrow('Another status page already uses "finance"');
  expect(() =>
    createPage(db, { slug: "Not OK", name: "x", components: [] }, "ana", NOW),
  ).toThrow(StatusPageError);
});

test("deleting a page removes its components and notices", () => {
  const db = testDb();
  const page = financePage(db);
  const notice = postNotice(
    db,
    {
      pageId: page.id,
      title: "x",
      impact: "degraded",
      status: "investigating",
      message: "m",
      componentIds: [],
    },
    "ana",
    NOW,
  );
  expect(deletePage(db, page.id)).toBe(true);
  expect(getPage(db, { id: page.id })).toBeNull();
  expect(listComponents(db, page.id)).toHaveLength(0);
  expect(listNotices(db, page.id, 0)).toHaveLength(0);
  expect(listUpdates(db, notice.id)).toHaveLength(0);
});

test("a page is listed only for someone who can see all of its services", () => {
  const db = testDb();
  financePage(db);
  createPage(
    db,
    {
      slug: "ops",
      name: "Ops",
      components: [{ name: "A", serviceIds: ["wh"] }],
    },
    "ana",
    NOW,
  );
  const partial = buildStatusPageList(db, new Set(["wh", "pg"]), false, NOW);
  expect(statusPageListSchema.parse(partial)).toEqual(partial);
  expect(partial.items.map((p) => p.slug)).toEqual(["ops"]);
  const all = buildStatusPageList(db, new Set(["wh", "pg", "ch"]), true, NOW);
  expect(all.items.map((p) => p.slug)).toEqual(["finance", "ops"]);
});

test("a notice is about its components' services, or the whole page's", () => {
  const db = testDb();
  const page = financePage(db);
  const [, dashboards] = listComponents(db, page.id);
  expect(noticeServiceIds(db, page.id, [dashboards?.id ?? ""])).toEqual([
    "pg",
    "ch",
  ]);
  expect(noticeServiceIds(db, page.id, [])).toEqual(["wh", "pg", "ch"]);
});

test("day bars show partial outages and uptime per day", () => {
  const db = testDb();
  const page = financePage(db);
  const yesterday = NOW - DAY_MS;
  record(db, "pg", "healthy", yesterday);
  record(db, "ch", "unavailable", yesterday);
  const detail = buildStatusPageDetail(
    db,
    page,
    { edit: false, post: false },
    NOW,
  );
  const day = detail.components[1]?.days.at(-2);
  expect(day).toMatchObject({ status: "partial-outage", availability: 50 });
  expect(detail.components[1]?.days.at(-1)?.status).toBeNull();
});

test("manual notices work without a Health snapshot and do not invent uptime", () => {
  const db = testDb();
  const page = financePage(db);
  postNotice(
    db,
    {
      pageId: page.id,
      title: "Delayed reports",
      impact: "degraded",
      status: "investigating",
      message: "Working on it",
      componentIds: [],
    },
    "operator",
    NOW,
  );
  const value = detail(db, page, { edit: true, post: true }, NOW);
  expect(value.status).toBe("degraded");
  expect(
    value.components.every((component) => component.status === "degraded"),
  ).toBe(true);
  expect(
    value.components.every((component) => component.availability === null),
  ).toBe(true);
  expect(value.components[0]?.days.every((day) => day.status === null)).toBe(
    true,
  );
});
