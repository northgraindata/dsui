/**
 * Actions the pages invoke.
 *
 * The host checks the permission an action declares against the plugin. These
 * handlers add the per-service check, because a role that may act on one
 * service must not act on another it cannot see.
 */
import {
  defineAction,
  type PluginContext,
  PluginRequestError,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import type { HealthConfig } from "./config.js";
import { openHealthDb } from "./db.js";
import {
  type ActionResult,
  acknowledgeIncident,
  getIncident,
  noteIncident,
  resolveIncident,
} from "./incidents.js";
import { readState } from "./repo.js";
import { clearSlo, writeSlo } from "./slo.js";
import {
  createSuppression,
  deleteSuppression,
  listSuppressions,
} from "./suppressions.js";
import { runTick } from "./tick.js";
import { listServices } from "./view.js";

type HealthContext = PluginContext<HealthConfig>;

/** Shortest gap between manual checks of the same service. */
export const CHECK_NOW_MIN_INTERVAL_MS = 10_000;

const actorOf = (context: HealthContext) =>
  context.access.principal?.()?.id ?? "local";

function failure(result: Extract<ActionResult, { ok: false }>): Error {
  switch (result.reason) {
    case "not-found":
      return new PluginRequestError("Incident not found", 404);
    case "already-resolved":
      return new PluginRequestError("Incident is already resolved", 409);
    case "already-acknowledged":
      return new PluginRequestError("Incident is already acknowledged", 409);
  }
}

async function authorizeIncident(
  context: HealthContext,
  incidentId: string,
  permission: "execute" | "manage",
) {
  const db = openHealthDb(context.storage);
  const incident = getIncident(db, incidentId);
  // Unknown and invisible look the same, so ids cannot be probed for.
  if (!incident || !(await context.services.get(incident.serviceId)))
    throw new PluginRequestError("Incident not found", 404);
  await context.access.require(incident.serviceId, permission);
  return { db, incident };
}

/**
 * Re-checks services now, bypassing their schedule.
 *
 * Limited per service so a page held open or a script cannot turn a manual
 * refresh into a probe loop against the monitored system. Services checked
 * too recently are skipped, not failed, and reported back.
 */
export const checkNow = defineAction({
  id: "check-now",
  input: z.object({
    serviceIds: z.array(z.string().min(1)).max(500).optional(),
  }),
  permission: "inspect",
  run: async (input, context: HealthContext) => {
    const db = openHealthDb(context.storage);
    const visible = await listServices(
      context.services,
      context.config.maxServices,
    );
    const wanted = input.serviceIds ? new Set(input.serviceIds) : null;
    const now = Date.now();
    const candidates = visible.filter(
      (service) => !wanted || wanted.has(service.id),
    );
    const ready = candidates.filter((service) => {
      const last = readState(db, service.id)?.lastCheckedAt;
      return last === undefined || now - last >= CHECK_NOW_MIN_INTERVAL_MS;
    });
    const result = await runTick(context, { only: ready });
    return {
      checked: result.checked,
      skipped: candidates.length - ready.length,
    };
  },
});

export const acknowledge = defineAction({
  id: "acknowledge-incident",
  input: z.object({ incidentId: z.string().min(1) }),
  permission: "execute",
  run: async (input, context: HealthContext) => {
    const { db } = await authorizeIncident(
      context,
      input.incidentId,
      "execute",
    );
    const result = acknowledgeIncident(
      db,
      input.incidentId,
      actorOf(context),
      Date.now(),
    );
    if (!result.ok) throw failure(result);
    return { status: result.incident.status };
  },
});

export const addNote = defineAction({
  id: "note-incident",
  input: z.object({
    incidentId: z.string().min(1),
    message: z.string().trim().min(1).max(2_000),
  }),
  permission: "execute",
  run: async (input, context: HealthContext) => {
    const { db } = await authorizeIncident(
      context,
      input.incidentId,
      "execute",
    );
    const result = noteIncident(
      db,
      input.incidentId,
      actorOf(context),
      input.message,
      Date.now(),
    );
    if (!result.ok) throw failure(result);
    return { ok: true };
  },
});

export const resolve = defineAction({
  id: "resolve-incident",
  input: z.object({
    incidentId: z.string().min(1),
    note: z.string().trim().max(2_000).optional(),
  }),
  permission: "execute",
  run: async (input, context: HealthContext) => {
    const { db } = await authorizeIncident(
      context,
      input.incidentId,
      "execute",
    );
    const result = resolveIncident(
      db,
      input.incidentId,
      actorOf(context),
      input.note || undefined,
      Date.now(),
    );
    if (!result.ok) throw failure(result);
    return { status: result.incident.status };
  },
});

export const setSlo = defineAction({
  id: "set-slo",
  input: z.object({
    serviceId: z.string().min(1),
    targetPercent: z.number().min(0).max(100),
    windowDays: z.number().int().min(1).max(90),
  }),
  permission: "manage",
  run: async (input, context: HealthContext) => {
    if (!(await context.services.get(input.serviceId)))
      throw new PluginRequestError("Service not found", 404);
    await context.access.require(input.serviceId, "manage");
    writeSlo(
      openHealthDb(context.storage),
      { ...input, actor: actorOf(context) },
      Date.now(),
    );
    return { ok: true };
  },
});

export const removeSlo = defineAction({
  id: "clear-slo",
  input: z.object({ serviceId: z.string().min(1) }),
  permission: "manage",
  run: async (input, context: HealthContext) => {
    if (!(await context.services.get(input.serviceId)))
      throw new PluginRequestError("Service not found", 404);
    await context.access.require(input.serviceId, "manage");
    clearSlo(openHealthDb(context.storage), input.serviceId);
    return { ok: true };
  },
});

export const addSuppression = defineAction({
  id: "create-suppression",
  input: z
    .object({
      kind: z.enum(["maintenance", "silence"]),
      /** `null` applies to every service and needs an administrator. */
      serviceId: z.string().min(1).nullable(),
      startsAt: z.number().finite(),
      endsAt: z.number().finite(),
      reason: z.string().trim().max(500).optional(),
    })
    .refine((value) => value.endsAt > value.startsAt, {
      message: "The end must be after the start",
    }),
  permission: "manage",
  run: async (input, context: HealthContext) => {
    if (input.serviceId === null) {
      if (!context.access.requireAdmin)
        throw new PluginRequestError(
          "Only an administrator can cover every service",
          403,
        );
      await context.access.requireAdmin();
    } else {
      if (!(await context.services.get(input.serviceId)))
        throw new PluginRequestError("Service not found", 404);
      await context.access.require(input.serviceId, "manage");
    }
    const created = createSuppression(
      openHealthDb(context.storage),
      {
        kind: input.kind,
        serviceId: input.serviceId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ...(input.reason ? { reason: input.reason } : {}),
        createdBy: actorOf(context),
      },
      Date.now(),
    );
    return { id: created.id };
  },
});

export const removeSuppression = defineAction({
  id: "delete-suppression",
  input: z.object({ id: z.string().min(1) }),
  permission: "manage",
  run: async (input, context: HealthContext) => {
    const db = openHealthDb(context.storage);
    const existing = listSuppressions(db, { now: 0, includePast: true }).find(
      (item) => item.id === input.id,
    );
    if (!existing) throw new PluginRequestError("Not found", 404);
    if (existing.serviceId === null) {
      if (!context.access.requireAdmin)
        throw new PluginRequestError(
          "Only an administrator can change this",
          403,
        );
      await context.access.requireAdmin();
    } else {
      if (!(await context.services.get(existing.serviceId)))
        throw new PluginRequestError("Not found", 404);
      await context.access.require(existing.serviceId, "manage");
    }
    deleteSuppression(db, input.id);
    return { ok: true };
  },
});
