/**
 * Status pages: what a group of people sees about the services they rely on.
 *
 * A page is made of components. A component is a name an audience recognises
 * ("Finance dashboards") backed by one or more services. Its status is derived
 * from the recorded health of those services and from the notices people post
 * on the page, so the page never probes anything.
 */
import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import {
  availability,
  type Counters,
  DAY_MS,
  type Health,
  type HealthData,
  mergeCounts,
} from "./health-data.js";

export const COMPONENT_STATUSES = [
  "operational",
  "maintenance",
  "degraded",
  "partial-outage",
  "major-outage",
] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number] | "unknown";

/** A notice's impact uses the same scale as a component's status. */
export const NOTICE_IMPACTS = COMPONENT_STATUSES;
export type NoticeImpact = (typeof NOTICE_IMPACTS)[number];

export const NOTICE_STATUSES = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

const severity: Record<ComponentStatus, number> = {
  unknown: -1,
  operational: 0,
  maintenance: 1,
  degraded: 2,
  "partial-outage": 3,
  "major-outage": 4,
};

export function worse(
  left: ComponentStatus,
  right: ComponentStatus,
): ComponentStatus {
  return severity[left] >= severity[right] ? left : right;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type StatusPage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
};

export type StatusComponent = {
  id: string;
  pageId: string;
  name: string;
  description: string | null;
  position: number;
  serviceIds: string[];
};

export type NoticeUpdate = {
  id: number;
  time: number;
  status: NoticeStatus;
  message: string;
  author: string | null;
};

export type Notice = {
  id: string;
  pageId: string;
  title: string;
  impact: NoticeImpact;
  status: NoticeStatus;
  componentIds: string[];
  /** The plugin that posted it, e.g. an incident plugin; `null` for a person. */
  source: string | null;
  createdBy: string | null;
  createdAt: number;
  resolvedAt: number | null;
};

type PageRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type ComponentRow = {
  id: string;
  page_id: string;
  name: string;
  description: string | null;
  position: number;
  service_ids_json: string;
};

type NoticeRow = {
  id: string;
  page_id: string;
  title: string;
  impact: NoticeImpact;
  status: NoticeStatus;
  component_ids_json: string;
  source: string | null;
  created_by: string | null;
  created_at: number;
  resolved_at: number | null;
};

const toPage = (row: PageRow): StatusPage => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toComponent = (row: ComponentRow): StatusComponent => ({
  id: row.id,
  pageId: row.page_id,
  name: row.name,
  description: row.description,
  position: row.position,
  serviceIds: JSON.parse(row.service_ids_json) as string[],
});

const toNotice = (row: NoticeRow): Notice => ({
  id: row.id,
  pageId: row.page_id,
  title: row.title,
  impact: row.impact,
  status: row.status,
  componentIds: JSON.parse(row.component_ids_json) as string[],
  source: row.source,
  createdBy: row.created_by,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
});

export function listPages(db: Database): StatusPage[] {
  return db
    .query<PageRow, []>("SELECT * FROM status_pages ORDER BY name")
    .all()
    .map(toPage);
}

export function getPage(
  db: Database,
  key: { id: string } | { slug: string },
): StatusPage | null {
  const row =
    "id" in key
      ? db
          .query<PageRow, [string]>("SELECT * FROM status_pages WHERE id = ?")
          .get(key.id)
      : db
          .query<PageRow, [string]>("SELECT * FROM status_pages WHERE slug = ?")
          .get(key.slug);
  return row ? toPage(row) : null;
}

export function listComponents(
  db: Database,
  pageId: string,
): StatusComponent[] {
  return db
    .query<ComponentRow, [string]>(
      "SELECT * FROM status_page_components WHERE page_id = ? ORDER BY position",
    )
    .all(pageId)
    .map(toComponent);
}

/** Every service a page shows, in component order, without repeats. */
export function pageServiceIds(db: Database, pageId: string): string[] {
  return [
    ...new Set(
      listComponents(db, pageId).flatMap((component) => component.serviceIds),
    ),
  ];
}

export type ComponentInput = {
  /** Keeps a component's id, and so its notices, across edits. */
  id?: string;
  name: string;
  description?: string;
  serviceIds: readonly string[];
};

export type PageInput = {
  slug: string;
  name: string;
  description?: string;
  components: readonly ComponentInput[];
};

export class StatusPageError extends Error {
  constructor(
    message: string,
    readonly reason: "slug-taken" | "not-found" | "invalid",
  ) {
    super(message);
    this.name = "StatusPageError";
  }
}

function writeComponents(
  db: Database,
  pageId: string,
  components: readonly ComponentInput[],
): void {
  const existing = new Set(
    listComponents(db, pageId).map((component) => component.id),
  );
  const kept = new Set<string>();
  const upsert = db.query(
    `INSERT INTO status_page_components (id, page_id, name, description, position, service_ids_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
       position = excluded.position, service_ids_json = excluded.service_ids_json`,
  );
  for (const [position, component] of components.entries()) {
    // An id from another page is treated as new rather than moved.
    const id =
      component.id && existing.has(component.id) ? component.id : randomUUID();
    kept.add(id);
    upsert.run(
      id,
      pageId,
      component.name,
      component.description ?? null,
      position,
      JSON.stringify([...new Set(component.serviceIds)]),
    );
  }
  const remove = db.query("DELETE FROM status_page_components WHERE id = ?");
  for (const id of existing) if (!kept.has(id)) remove.run(id);
}

function assertSlugFree(db: Database, slug: string, pageId?: string): void {
  if (!SLUG_PATTERN.test(slug))
    throw new StatusPageError(
      "Use lowercase letters, digits and single dashes for the address",
      "invalid",
    );
  const holder = getPage(db, { slug });
  if (holder && holder.id !== pageId)
    throw new StatusPageError(
      `Another status page already uses "${slug}"`,
      "slug-taken",
    );
}

export function createPage(
  db: Database,
  input: PageInput,
  actor: string,
  now: number,
): StatusPage {
  return db.transaction(() => {
    assertSlugFree(db, input.slug);
    const page: StatusPage = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    db.query(
      `INSERT INTO status_pages (id, slug, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(page.id, page.slug, page.name, page.description, actor, now, now);
    writeComponents(db, page.id, input.components);
    return page;
  })();
}

export function updatePage(
  db: Database,
  pageId: string,
  input: PageInput,
  now: number,
): StatusPage {
  return db.transaction(() => {
    const current = getPage(db, { id: pageId });
    if (!current)
      throw new StatusPageError("Status page not found", "not-found");
    assertSlugFree(db, input.slug, pageId);
    db.query(
      "UPDATE status_pages SET slug = ?, name = ?, description = ?, updated_at = ? WHERE id = ?",
    ).run(input.slug, input.name, input.description ?? null, now, pageId);
    writeComponents(db, pageId, input.components);
    return {
      ...current,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      updatedAt: now,
    };
  })();
}

/** Deletes a page with its components and notices. */
export function deletePage(db: Database, pageId: string): boolean {
  return db.transaction(() => {
    db.query(
      "DELETE FROM notice_updates WHERE notice_id IN (SELECT id FROM notices WHERE page_id = ?)",
    ).run(pageId);
    db.query("DELETE FROM notices WHERE page_id = ?").run(pageId);
    db.query("DELETE FROM status_page_components WHERE page_id = ?").run(
      pageId,
    );
    return (
      db.query("DELETE FROM status_pages WHERE id = ?").run(pageId).changes > 0
    );
  })();
}

export function getNotice(db: Database, id: string): Notice | null {
  const row = db
    .query<NoticeRow, [string]>("SELECT * FROM notices WHERE id = ?")
    .get(id);
  return row ? toNotice(row) : null;
}

/** Ongoing notices, and resolved ones newer than `since`, newest first. */
export function listNotices(
  db: Database,
  pageId: string,
  since: number,
): Notice[] {
  return db
    .query<NoticeRow, [string, number]>(
      `SELECT * FROM notices WHERE page_id = ? AND (resolved_at IS NULL OR resolved_at >= ?)
       ORDER BY created_at DESC LIMIT 100`,
    )
    .all(pageId, since)
    .map(toNotice);
}

export function listUpdates(db: Database, noticeId: string): NoticeUpdate[] {
  return db
    .query<
      {
        id: number;
        time: number;
        status: NoticeStatus;
        message: string;
        author: string | null;
      },
      [string]
    >(
      "SELECT id, time, status, message, author FROM notice_updates WHERE notice_id = ? ORDER BY time DESC, id DESC",
    )
    .all(noticeId);
}

function addUpdate(
  db: Database,
  noticeId: string,
  update: Omit<NoticeUpdate, "id">,
): void {
  db.query(
    "INSERT INTO notice_updates (notice_id, time, status, message, author) VALUES (?, ?, ?, ?, ?)",
  ).run(noticeId, update.time, update.status, update.message, update.author);
}

function knownComponents(
  db: Database,
  pageId: string,
  componentIds: readonly string[],
): string[] {
  const known = new Set(listComponents(db, pageId).map((c) => c.id));
  const unknown = componentIds.filter((id) => !known.has(id));
  if (unknown.length > 0)
    throw new StatusPageError(
      "A notice can only name components of its own page",
      "invalid",
    );
  return [...new Set(componentIds)];
}

export type NoticeInput = {
  pageId: string;
  title: string;
  impact: NoticeImpact;
  status: Exclude<NoticeStatus, "resolved">;
  message: string;
  componentIds: readonly string[];
  source?: string;
};

export function postNotice(
  db: Database,
  input: NoticeInput,
  author: string,
  now: number,
): Notice {
  return db.transaction(() => {
    if (!getPage(db, { id: input.pageId }))
      throw new StatusPageError("Status page not found", "not-found");
    const notice: Notice = {
      id: randomUUID(),
      pageId: input.pageId,
      title: input.title,
      impact: input.impact,
      status: input.status,
      componentIds: knownComponents(db, input.pageId, input.componentIds),
      source: input.source ?? null,
      createdBy: author,
      createdAt: now,
      resolvedAt: null,
    };
    db.query(
      `INSERT INTO notices (id, page_id, title, impact, status, component_ids_json, source, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      notice.id,
      notice.pageId,
      notice.title,
      notice.impact,
      notice.status,
      JSON.stringify(notice.componentIds),
      notice.source,
      author,
      now,
    );
    addUpdate(db, notice.id, {
      time: now,
      status: input.status,
      message: input.message,
      author,
    });
    return notice;
  })();
}

export type NoticeChange = {
  status: NoticeStatus;
  message: string;
  impact?: NoticeImpact;
  componentIds?: readonly string[];
};

/** Adds an update; `resolved` closes the notice. A closed notice stays closed. */
export function updateNotice(
  db: Database,
  noticeId: string,
  change: NoticeChange,
  author: string,
  now: number,
): Notice {
  return db.transaction(() => {
    const notice = getNotice(db, noticeId);
    if (!notice) throw new StatusPageError("Notice not found", "not-found");
    if (notice.resolvedAt !== null)
      throw new StatusPageError("This notice is already resolved", "invalid");
    const next: Notice = {
      ...notice,
      status: change.status,
      impact: change.impact ?? notice.impact,
      componentIds: change.componentIds
        ? knownComponents(db, notice.pageId, change.componentIds)
        : notice.componentIds,
      resolvedAt: change.status === "resolved" ? now : null,
    };
    db.query(
      "UPDATE notices SET status = ?, impact = ?, component_ids_json = ?, resolved_at = ? WHERE id = ?",
    ).run(
      next.status,
      next.impact,
      JSON.stringify(next.componentIds),
      next.resolvedAt,
      noticeId,
    );
    addUpdate(db, noticeId, {
      time: now,
      status: change.status,
      message: change.message,
      author,
    });
    return next;
  })();
}

/** A component's status from the health of its services alone. */
export function statusFromHealth(
  states: readonly (Health | null)[],
  inMaintenance: boolean,
): ComponentStatus {
  const known = states.filter(
    (health): health is Exclude<Health, "unknown"> =>
      health !== null && health !== "unknown",
  );
  const down = known.filter((health) => health === "unavailable").length;
  if (down > 0 && down === states.length) return "major-outage";
  if (down > 0) return "partial-outage";
  if (known.some((health) => health === "warning")) return "degraded";
  if (inMaintenance) return "maintenance";
  if (known.length === 0) return "unknown";
  return "operational";
}

export type DayBar = {
  time: number;
  /** Worst status seen that day, from recorded checks. */
  status: ComponentStatus | null;
  availability: number | null;
};

export type ComponentView = {
  id: string;
  name: string;
  description: string | null;
  serviceIds: string[];
  status: ComponentStatus;
  /** Uptime over the days shown, from recorded checks. */
  availability: number | null;
  days: DayBar[];
};

function dayStatus(rollup: Counters | undefined): ComponentStatus | null {
  if (!rollup) return null;
  if (rollup.unavailable > 0)
    return rollup.healthy + rollup.warning > 0
      ? "partial-outage"
      : "major-outage";
  if (rollup.warning > 0) return "degraded";
  if (rollup.healthy > 0) return "operational";
  if (rollup.maintenance > 0) return "maintenance";
  return null;
}

export const STATUS_DAYS = 90;

function componentDays(
  health: HealthData | undefined,
  serviceIds: readonly string[],
  now: number,
  days: number,
): { days: DayBar[]; availability: number | null } {
  const end = Math.floor(now / DAY_MS) * DAY_MS;
  const from = end - (days - 1) * DAY_MS;
  const perService = serviceIds.map(
    (id) =>
      new Map(
        (health?.services.find((service) => service.id === id)?.days ?? [])
          .filter((day) => day.time >= from && day.time <= now)
          .map((day) => [day.time, day]),
      ),
  );
  const bars = Array.from({ length: days }, (_, index) => {
    const time = from + index * DAY_MS;
    const present = perService.flatMap((rollups) => {
      const rollup = rollups.get(time);
      return rollup ? [rollup] : [];
    });
    const merged = present.length > 0 ? mergeCounts(present) : undefined;
    return {
      time,
      status: dayStatus(merged),
      availability: merged ? availability(merged) : null,
    };
  });
  const total = mergeCounts(
    perService.flatMap((rollups) => [...rollups.values()]),
  );
  return { days: bars, availability: availability(total) };
}

/** Components with their current status and daily history. */
export function buildComponents(
  db: Database,
  pageId: string,
  activeNotices: readonly Notice[],
  now: number,
  days = STATUS_DAYS,
  health?: HealthData,
): ComponentView[] {
  const states = new Map(
    health?.services.map((service) => [service.id, service]),
  );
  return listComponents(db, pageId).map((component) => {
    const fromHealth = statusFromHealth(
      component.serviceIds.map((id) => states.get(id)?.health ?? null),
      component.serviceIds.some((id) => states.get(id)?.maintenance ?? false),
    );
    const fromNotices = activeNotices
      .filter(
        (notice) =>
          notice.componentIds.length === 0 ||
          notice.componentIds.includes(component.id),
      )
      .reduce<ComponentStatus>(
        (status, notice) => worse(status, notice.impact),
        "unknown",
      );
    const history = componentDays(health, component.serviceIds, now, days);
    return {
      id: component.id,
      name: component.name,
      description: component.description,
      serviceIds: component.serviceIds,
      status: worse(fromHealth, fromNotices),
      availability: history.availability,
      days: history.days,
    };
  });
}

/** The page's headline: its worst component. */
export function overallStatus(
  components: readonly { status: ComponentStatus }[],
): ComponentStatus {
  return components.reduce<ComponentStatus>(
    (status, component) => worse(status, component.status),
    "unknown",
  );
}
