import type { SignalType } from "@northgraindata/dsui-adapter-sdk";
import { z } from "zod";
import { healthSchema } from "./context.js";
import type { IncidentEffect } from "./incidents.js";

/**
 * Signals the plugin emits when a service's accepted health changes.
 *
 * They fire after debouncing and never during maintenance or a silence, so a
 * consumer sees one event per real change rather than one per failed probe.
 * Ids are published as `health.<id>`.
 */
const failingCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().optional(),
});

export const signalPayloadSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  /** Accepted health before the change; `null` when first observed. */
  previous: healthSchema.nullable(),
  current: healthSchema,
  /** When the service entered `current`, in epoch milliseconds. */
  since: z.number(),
  incidentId: z.string(),
  summary: z.string(),
  failingChecks: z.array(failingCheckSchema),
  latencyMs: z.number().optional(),
});
export type SignalPayload = z.infer<typeof signalPayloadSchema>;

export const weeklyReportPayloadSchema = z.object({
  days: z.number(),
  from: z.number(),
  to: z.number(),
  availability: z.number().nullable(),
  previousAvailability: z.number().nullable(),
  incidentsOpened: z.number(),
  incidentsResolved: z.number(),
  meanTimeToResolveMs: z.number().nullable(),
  /** The services with the lowest uptime in the period, worst first. */
  lowest: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      availability: z.number().nullable(),
      incidents: z.number(),
    }),
  ),
  /** One readable line, for consumers that render a summary. */
  summary: z.string(),
});
export type WeeklyReportPayload = z.infer<typeof weeklyReportPayloadSchema>;

export const WEEKLY_REPORT = { id: "weekly-report", type: "info" } as const;

export const SIGNALS = {
  unavailable: { id: "service-unavailable", type: "error" },
  degraded: { id: "service-degraded", type: "warning" },
  recovered: { id: "service-recovered", type: "success" },
} as const satisfies Record<string, { id: string; type: SignalType }>;

export type SignalEmission = {
  id: string;
  type: SignalType;
  serviceId: string;
  payload: SignalPayload;
};

function definitionFor(effect: IncidentEffect) {
  if (effect.kind === "resolved") return SIGNALS.recovered;
  return effect.incident.severity === "unavailable"
    ? SIGNALS.unavailable
    : SIGNALS.degraded;
}

function elapsed(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function summaryFor(effect: IncidentEffect): string {
  const { incident } = effect;
  if (effect.kind !== "resolved" || incident.resolvedAt === null)
    return incident.summary;
  return `Recovered after ${elapsed(incident.resolvedAt - incident.openedAt)}`;
}

/** Maps an incident change to the signal that announces it, if any. */
export function signalFor(
  effect: IncidentEffect | null,
  context: Omit<SignalPayload, "incidentId" | "summary">,
): SignalEmission | null {
  if (!effect) return null;
  const definition = definitionFor(effect);
  return {
    id: definition.id,
    type: definition.type,
    serviceId: context.serviceId,
    payload: {
      ...context,
      incidentId: effect.incident.id,
      summary: summaryFor(effect),
    },
  };
}

type Registry = {
  signal(definition: {
    id: string;
    payload: z.ZodTypeAny;
    type?: SignalType;
  }): void;
};

export function registerSignals(registry: Registry): void {
  for (const definition of Object.values(SIGNALS))
    registry.signal({
      id: definition.id,
      type: definition.type,
      payload: signalPayloadSchema,
    });
  registry.signal({
    id: WEEKLY_REPORT.id,
    type: WEEKLY_REPORT.type,
    payload: weeklyReportPayloadSchema,
  });
}
