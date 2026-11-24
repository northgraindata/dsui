/**
 * Resources and actions for status pages.
 *
 * The host checks the plugin-level permission an action declares. These
 * handlers add the per-service checks: a page shows several services, and a
 * role that may act on one of them must not change what is said about the
 * others.
 */

import {
  defineAction,
  defineResource,
  type PluginContext,
  PluginRequestError,
  poll,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import type { StatusConfig } from "./config.js";
import { noticeImpactSchema, noticeStatusSchema } from "./contract.js";
import { openStatusDb } from "./db.js";
import { readHealth } from "./health-data.js";
import { statusPagesIconUrl } from "./logo.js";
import { listServices } from "./services.js";
import {
  createPage,
  deletePage,
  getNotice,
  getPage,
  pageServiceIds,
  postNotice,
  SLUG_PATTERN,
  type StatusPage,
  StatusPageError,
  updateNotice,
  updatePage,
} from "./status-pages.js";
import {
  buildStatusPageDetail,
  buildStatusPageList,
  canSee,
  noticeServiceIds,
} from "./status-view.js";

type StatusContext = PluginContext<StatusConfig>;
type Permission = "inspect" | "execute" | "manage";

const actorOf = (context: StatusContext) =>
  context.access.principal?.()?.id ?? "local";

async function visibleIds(context: StatusContext): Promise<Set<string>> {
  const services = await listServices(
    context.services,
    context.config.maxServices,
  );
  return new Set(services.map((service) => service.id));
}

async function isAdmin(context: StatusContext): Promise<boolean> {
  if (!context.access.requireAdmin) return false;
  try {
    await context.access.requireAdmin();
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the requester holds `permission` on every service.
 *
 * A page or notice with no services is not about anything a service grant
 * covers, so it takes an administrator.
 */
async function allowedOn(
  context: StatusContext,
  serviceIds: readonly string[],
  permission: Permission,
): Promise<boolean> {
  if (serviceIds.length === 0) return isAdmin(context);
  try {
    for (const id of serviceIds) await context.access.require(id, permission);
    return true;
  } catch {
    return false;
  }
}

async function requireOn(
  context: StatusContext,
  serviceIds: readonly string[],
  permission: Permission,
): Promise<void> {
  if (!(await allowedOn(context, serviceIds, permission)))
    throw new PluginRequestError(
      "You need access to every service on this status page",
      403,
    );
}

function failure(error: unknown): Error {
  if (!(error instanceof StatusPageError))
    return error instanceof Error ? error : new Error(String(error));
  switch (error.reason) {
    case "not-found":
      return new PluginRequestError(error.message, 404);
    case "slug-taken":
      return new PluginRequestError(error.message, 409);
    case "invalid":
      return new PluginRequestError(error.message, 422);
  }
}

/** A page the requester can see; unknown and hidden look the same. */
async function visiblePage(
  context: StatusContext,
  key: { id: string } | { slug: string },
): Promise<StatusPage> {
  const db = openStatusDb(context.storage);
  const page = getPage(db, key);
  if (!page || !canSee(db, page, await visibleIds(context)))
    throw new PluginRequestError("Status page not found", 404);
  return page;
}

export const statusPages = defineResource({
  id: "status-pages",
  input: z.object({}).optional(),
  query: async (_input, context: StatusContext) => {
    const visible = await visibleIds(context);
    const health = await readHealth(context);
    return {
      ...buildStatusPageList(
        openStatusDb(context.storage),
        visible,
        await isAdmin(context),
        Date.now(),
        health.data,
      ),
      iconUrl: statusPagesIconUrl,
      healthAvailable: Boolean(health.data),
      healthError: health.error,
    };
  },
  refresh: poll("30s"),
});

export const statusPage = defineResource({
  id: "status-page",
  input: z.object({ slug: z.string().min(1) }),
  query: async (input, context: StatusContext) => {
    const page = await visiblePage(context, { slug: input.slug });
    const db = openStatusDb(context.storage);
    const serviceIds = pageServiceIds(db, page.id);
    const health = await readHealth(context);
    return {
      ...buildStatusPageDetail(
        db,
        page,
        {
          edit: await allowedOn(context, serviceIds, "manage"),
          post: await allowedOn(context, serviceIds, "execute"),
        },
        Date.now(),
        health.data,
      ),
      healthAvailable: Boolean(health.data),
      healthError: health.error,
    };
  },
  refresh: poll("30s"),
});

const componentInput = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).optional(),
  serviceIds: z.array(z.string().min(1)).min(1).max(100),
});

const pageInput = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(SLUG_PATTERN, "Use lowercase letters, digits and single dashes"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  components: z.array(componentInput).max(50),
});

const servicesOf = (input: z.infer<typeof pageInput>) => [
  ...new Set(input.components.flatMap((component) => component.serviceIds)),
];

async function requireVisible(
  context: StatusContext,
  serviceIds: readonly string[],
): Promise<void> {
  const visible = await visibleIds(context);
  if (serviceIds.some((id) => !visible.has(id)))
    throw new PluginRequestError("Service not found", 404);
}

export const createStatusPage = defineAction({
  id: "create-status-page",
  input: pageInput,
  permission: "manage",
  run: async (input, context: StatusContext) => {
    const serviceIds = servicesOf(input);
    await requireVisible(context, serviceIds);
    await requireOn(context, serviceIds, "manage");
    try {
      const page = createPage(
        openStatusDb(context.storage),
        input,
        actorOf(context),
        Date.now(),
      );
      return { id: page.id, slug: page.slug };
    } catch (error) {
      throw failure(error);
    }
  },
});

export const updateStatusPage = defineAction({
  id: "update-status-page",
  input: pageInput.extend({ id: z.string().min(1) }),
  permission: "manage",
  run: async ({ id, ...input }, context: StatusContext) => {
    const page = await visiblePage(context, { id });
    const db = openStatusDb(context.storage);
    const serviceIds = servicesOf(input);
    await requireVisible(context, serviceIds);
    // Both the services leaving the page and those joining it change what
    // the page says about them.
    await requireOn(
      context,
      [...new Set([...pageServiceIds(db, page.id), ...serviceIds])],
      "manage",
    );
    try {
      const updated = updatePage(db, page.id, input, Date.now());
      return { id: updated.id, slug: updated.slug };
    } catch (error) {
      throw failure(error);
    }
  },
});

export const deleteStatusPage = defineAction({
  id: "delete-status-page",
  input: z.object({ id: z.string().min(1) }),
  permission: "manage",
  run: async (input, context: StatusContext) => {
    const page = await visiblePage(context, { id: input.id });
    const db = openStatusDb(context.storage);
    await requireOn(context, pageServiceIds(db, page.id), "manage");
    deletePage(db, page.id);
    return { ok: true };
  },
});

const noticeMessage = z.string().trim().min(1).max(2_000);

/**
 * Posts a notice to a status page.
 *
 * Operators can post, since telling people what is going on is part of
 * handling a problem. An incident plugin calls this from a background job to
 * publish its updates; `source` names it on the page.
 */
export const postStatusNotice = defineAction({
  id: "post-notice",
  input: z
    .object({
      pageId: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      title: z.string().trim().min(1).max(160),
      impact: noticeImpactSchema,
      status: noticeStatusSchema.exclude(["resolved"]).default("investigating"),
      message: noticeMessage,
      componentIds: z.array(z.string().min(1)).max(50).default([]),
      source: z.string().trim().min(1).max(60).optional(),
    })
    .refine((value) => value.pageId || value.slug, {
      message: "Name the status page by id or slug",
    }),
  permission: "execute",
  run: async (input, context: StatusContext) => {
    const page = await visiblePage(
      context,
      input.pageId ? { id: input.pageId } : { slug: input.slug ?? "" },
    );
    const db = openStatusDb(context.storage);
    await requireOn(
      context,
      noticeServiceIds(db, page.id, input.componentIds),
      "execute",
    );
    try {
      const notice = postNotice(
        db,
        {
          pageId: page.id,
          title: input.title,
          impact: input.impact,
          status: input.status,
          message: input.message,
          componentIds: input.componentIds,
          ...(input.source ? { source: input.source } : {}),
        },
        actorOf(context),
        Date.now(),
      );
      return { id: notice.id, pageId: page.id, slug: page.slug };
    } catch (error) {
      throw failure(error);
    }
  },
});

async function authorizeNotice(context: StatusContext, noticeId: string) {
  const db = openStatusDb(context.storage);
  const notice = getNotice(db, noticeId);
  if (!notice) throw new PluginRequestError("Notice not found", 404);
  const page = getPage(db, { id: notice.pageId });
  if (!page || !canSee(db, page, await visibleIds(context)))
    throw new PluginRequestError("Notice not found", 404);
  await requireOn(
    context,
    noticeServiceIds(db, page.id, notice.componentIds),
    "execute",
  );
  return { db, notice };
}

export const updateStatusNotice = defineAction({
  id: "update-notice",
  input: z.object({
    noticeId: z.string().min(1),
    status: noticeStatusSchema,
    message: noticeMessage,
    impact: noticeImpactSchema.optional(),
  }),
  permission: "execute",
  run: async (input, context: StatusContext) => {
    const { db } = await authorizeNotice(context, input.noticeId);
    try {
      const notice = updateNotice(
        db,
        input.noticeId,
        {
          status: input.status,
          message: input.message,
          ...(input.impact ? { impact: input.impact } : {}),
        },
        actorOf(context),
        Date.now(),
      );
      return { id: notice.id, status: notice.status };
    } catch (error) {
      throw failure(error);
    }
  },
});

export const resolveStatusNotice = defineAction({
  id: "resolve-notice",
  input: z.object({
    noticeId: z.string().min(1),
    message: noticeMessage.default("This is resolved."),
  }),
  permission: "execute",
  run: async (input, context: StatusContext) => {
    const { db } = await authorizeNotice(context, input.noticeId);
    try {
      const notice = updateNotice(
        db,
        input.noticeId,
        { status: "resolved", message: input.message },
        actorOf(context),
        Date.now(),
      );
      return { id: notice.id, status: notice.status };
    } catch (error) {
      throw failure(error);
    }
  },
});
