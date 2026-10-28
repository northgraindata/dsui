/**
 * Resources the pages read.
 *
 * Every one reads recorded results from the plugin database. None of them
 * probes: probing is the scheduler's job, so the number of open pages never
 * changes how hard monitored systems are contacted.
 */
import {
  defineResource,
  type PluginContext,
  PluginRequestError,
  poll,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import type { HealthConfig } from "../config.js";
import { openHealthDb } from "../db.js";
import { getIncident } from "../incidents.js";
import { buildReport } from "../report.js";
import {
  buildFleet,
  buildIncidentDetail,
  buildIncidentList,
  buildServiceDetail,
  buildSuppressionList,
  listServices,
} from "../view.js";

type HealthContext = PluginContext<HealthConfig>;

/** Health of every visible service. */
export const serviceHealth = defineResource({
  id: "service-health",
  input: z.object({}).optional(),
  query: async (_input, context: HealthContext) =>
    buildFleet(
      openHealthDb(context.storage),
      await listServices(context.services, context.config.maxServices),
      Date.now(),
    ),
  refresh: poll("15s"),
});

const serviceInput = z.object({ serviceId: z.string().min(1) });

/** One service's state, statistics, history, incidents and objectives. */
export const serviceDetail = defineResource({
  id: "service-detail",
  input: serviceInput,
  query: async (input, context: HealthContext) => {
    const service = await context.services.get(input.serviceId);
    if (!service) throw new PluginRequestError("Service not found", 404);
    const summary = {
      id: service.id,
      name: service.name,
      adapter: service.adapter,
      managedBy: service.managedBy,
      ...(service.iconUrl ? { iconUrl: service.iconUrl } : {}),
    };
    return buildServiceDetail(
      openHealthDb(context.storage),
      context.config,
      summary,
      new Map([[summary.id, summary]]),
      Date.now(),
    );
  },
  refresh: poll("15s"),
});

/** Incidents for the services the requester can see. */
export const incidents = defineResource({
  id: "incidents",
  input: z
    .object({
      status: z.enum(["active", "resolved", "all"]).default("all"),
      serviceId: z.string().min(1).optional(),
    })
    .default({}),
  query: async (input, context: HealthContext) =>
    buildIncidentList(
      openHealthDb(context.storage),
      await listServices(context.services, context.config.maxServices),
      {
        status: input.status,
        ...(input.serviceId ? { serviceId: input.serviceId } : {}),
      },
      Date.now(),
    ),
  refresh: poll("15s"),
});

/** One incident with its timeline. */
export const incidentDetail = defineResource({
  id: "incident-detail",
  input: z.object({ incidentId: z.string().min(1) }),
  query: async (input, context: HealthContext) => {
    const db = openHealthDb(context.storage);
    const incident = getIncident(db, input.incidentId);
    const service = incident
      ? await context.services.get(incident.serviceId)
      : null;
    if (!incident || !service)
      throw new PluginRequestError("Incident not found", 404);
    const summary = {
      id: service.id,
      name: service.name,
      adapter: service.adapter,
      managedBy: service.managedBy,
    };
    return buildIncidentDetail(
      db,
      incident,
      new Map([[summary.id, summary]]),
      Date.now(),
    );
  },
  refresh: poll("15s"),
});

/** Maintenance windows and silences that are active or upcoming. */
export const suppressions = defineResource({
  id: "suppressions",
  input: z.object({}).optional(),
  query: async (_input, context: HealthContext) => {
    const services = await listServices(
      context.services,
      context.config.maxServices,
    );
    return buildSuppressionList(
      openHealthDb(context.storage),
      new Map(services.map((service) => [service.id, service])),
      Date.now(),
    );
  },
  refresh: poll("30s"),
});

/** This period against the one before it. */
export const report = defineResource({
  id: "report",
  input: z
    .object({ days: z.union([z.literal(7), z.literal(30)]).default(7) })
    .default({}),
  query: async (input, context: HealthContext) =>
    buildReport(
      openHealthDb(context.storage),
      await listServices(context.services, context.config.maxServices),
      input.days,
      Date.now(),
    ),
  refresh: poll("60s"),
});

export const resources = [
  serviceHealth,
  serviceDetail,
  incidents,
  incidentDetail,
  suppressions,
  report,
] as const;
