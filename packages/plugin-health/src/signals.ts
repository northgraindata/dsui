import type { SignalType } from "@northgraindata/dsui-adapter-sdk";
import { z } from "zod";
import { healthSchema } from "./context.js";
import type { OutageEffect } from "./outages.js";

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
  /**
   * Stable for one outage, from the first failure to recovery, including
   * escalations and a quick relapse. Lets an incident plugin group the
   * signals of one problem.
   */
  stateKey: z.string(),
  /** When the outage started, in epoch milliseconds. */
  startedAt: z.number(),
  /** One readable line, at most 300 characters. */
  summary: z.string().max(300),
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
  outagesStarted: z.number(),
  outagesEnded: z.number(),
  meanTimeToRecoverMs: z.number().nullable(),
  /** The services with the lowest uptime in the period, worst first. */
  lowest: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      availability: z.number().nullable(),
      outages: z.number(),
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

function definitionFor(effect: OutageEffect) {
  if (effect.kind === "ended") return SIGNALS.recovered;
  return effect.outage.severity === "unavailable"
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

/** Notification consumers show at most 300 characters. */
export const SUMMARY_MAX = 300;

function clip(text: string): string {
  return text.length <= SUMMARY_MAX
    ? text
    : `${text.slice(0, SUMMARY_MAX - 1).trimEnd()}…`;
}

function summaryFor(effect: OutageEffect, serviceName: string): string {
  const { outage } = effect;
  if (effect.kind === "ended" && outage.endedAt !== null)
    return clip(
      `${serviceName} recovered after ${elapsed(outage.endedAt - outage.startedAt)}`,
    );
  const state = outage.severity === "unavailable" ? "is down" : "is degraded";
  return clip(`${serviceName} ${state}: ${outage.summary}`);
}

/** Maps an outage change to the signal that announces it, if any. */
export function signalFor(
  effect: OutageEffect | null,
  context: Omit<SignalPayload, "stateKey" | "startedAt" | "summary">,
): SignalEmission | null {
  if (!effect) return null;
  const definition = definitionFor(effect);
  return {
    id: definition.id,
    type: definition.type,
    serviceId: context.serviceId,
    payload: {
      ...context,
      stateKey: effect.outage.id,
      startedAt: effect.outage.startedAt,
      summary: summaryFor(effect, context.serviceName),
    },
  };
}

type Registry = {
  signal(definition: {
    id: string;
    payload: z.ZodTypeAny;
    type?: SignalType;
    scope?: "service" | "global";
  }): void;
};

export function registerSignals(registry: Registry): void {
  for (const definition of Object.values(SIGNALS))
    registry.signal({
      id: definition.id,
      type: definition.type,
      scope: "service",
      payload: signalPayloadSchema,
    });
  registry.signal({
    id: WEEKLY_REPORT.id,
    type: WEEKLY_REPORT.type,
    payload: weeklyReportPayloadSchema,
  });
}
