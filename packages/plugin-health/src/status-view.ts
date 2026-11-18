import type { Database } from "bun:sqlite";
import {
  CONTRACT_VERSION,
  type NoticeView,
  type StatusPageDetail,
  type StatusPageList,
} from "./contract.js";
import { DAY_MS } from "./rollups.js";
import {
  buildComponents,
  listComponents,
  listNotices,
  listPages,
  listUpdates,
  type Notice,
  overallStatus,
  pageServiceIds,
  type StatusPage,
} from "./status-pages.js";

/** Resolved notices stay on a page for this long. */
export const NOTICE_HISTORY_MS = 30 * DAY_MS;

/**
 * A page is visible to someone who can see every service on it.
 *
 * Showing a page with some services hidden would either leak their status
 * through the component or show a component that silently means less than
 * it says, so it is all or nothing.
 */
export function canSee(
  db: Database,
  page: StatusPage,
  visible: ReadonlySet<string>,
): boolean {
  return pageServiceIds(db, page.id).every((id) => visible.has(id));
}

function noticeView(db: Database, notice: Notice): NoticeView {
  return {
    id: notice.id,
    title: notice.title,
    impact: notice.impact,
    status: notice.status,
    componentIds: notice.componentIds,
    source: notice.source,
    createdAt: notice.createdAt,
    resolvedAt: notice.resolvedAt,
    updates: listUpdates(db, notice.id),
  };
}

export function buildStatusPageList(
  db: Database,
  visible: ReadonlySet<string>,
  canCreate: boolean,
  now: number,
): StatusPageList {
  return {
    version: CONTRACT_VERSION,
    generatedAt: now,
    canCreate,
    items: listPages(db)
      .filter((page) => canSee(db, page, visible))
      .map((page) => {
        const active = listNotices(db, page.id, now).filter(
          (notice) => notice.resolvedAt === null,
        );
        const components = buildComponents(db, page.id, active, now, 1);
        return {
          id: page.id,
          slug: page.slug,
          name: page.name,
          description: page.description,
          status: overallStatus(components),
          components: components.length,
          activeNotices: active.length,
          updatedAt: page.updatedAt,
        };
      }),
  };
}

export function buildStatusPageDetail(
  db: Database,
  page: StatusPage,
  can: { edit: boolean; post: boolean },
  now: number,
): StatusPageDetail {
  const notices = listNotices(db, page.id, now - NOTICE_HISTORY_MS);
  const active = notices.filter((notice) => notice.resolvedAt === null);
  const components = buildComponents(db, page.id, active, now);
  return {
    version: CONTRACT_VERSION,
    generatedAt: now,
    page: {
      id: page.id,
      slug: page.slug,
      name: page.name,
      description: page.description,
      updatedAt: page.updatedAt,
    },
    status: overallStatus(components),
    components,
    active: active.map((notice) => noticeView(db, notice)),
    history: notices
      .filter((notice) => notice.resolvedAt !== null)
      .map((notice) => noticeView(db, notice)),
    can,
  };
}

/** The services a notice is about: its components', or the whole page's. */
export function noticeServiceIds(
  db: Database,
  pageId: string,
  componentIds: readonly string[],
): string[] {
  if (componentIds.length === 0) return pageServiceIds(db, pageId);
  const wanted = new Set(componentIds);
  return [
    ...new Set(
      listComponents(db, pageId)
        .filter((component) => wanted.has(component.id))
        .flatMap((component) => component.serviceIds),
    ),
  ];
}
