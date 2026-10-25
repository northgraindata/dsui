/**
 * The shapes the plugin's resources return.
 *
 * One source for the server that produces them and the browser that parses
 * them, and the contract other plugins read through the plugin catalog.
 * `CONTRACT_VERSION` increases only for a change that breaks a reader; adding
 * an optional field does not.
 */
import { z } from "zod";
import { healthSchema, serviceSummarySchema } from "./context.js";

export const CONTRACT_VERSION = 1;

const timestamp = z.number().finite();

export const stripStatusSchema = z.enum([
  "healthy",
  "warning",
  "unavailable",
  "unknown",
  "maintenance",
]);
export type StripStatus = z.infer<typeof stripStatusSchema>;

/** One hour (or day) of history; `health` is the worst status seen. */
export const stripBucketSchema = z.object({
  time: timestamp,
  health: stripStatusSchema.nullable(),
  samples: z.number(),
  latencyMs: z.number().nullable(),
});
export type StripBucket = z.infer<typeof stripBucketSchema>;

export const checkSchema = z.object({
  id: z.string(),
  label: z.string(),
  ok: z.boolean(),
  detail: z.string().optional(),
  /** Path inside the service workspace where this check can be investigated. */
  href: z.string().optional(),
});
export type Check = z.infer<typeof checkSchema>;

export const severitySchema = z.enum(["warning", "unavailable"]);
export const incidentStatusSchema = z.enum([
  "open",
  "acknowledged",
  "resolved",
]);

export const incidentSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  adapter: z.string(),
  status: incidentStatusSchema,
  severity: severitySchema,
  peakSeverity: severitySchema,
  summary: z.string(),
  openedAt: timestamp,
  acknowledgedAt: timestamp.nullable(),
  acknowledgedBy: z.string().nullable(),
  resolvedAt: timestamp.nullable(),
  resolvedBy: z.string().nullable(),
  resolutionNote: z.string().nullable(),
});
export type IncidentView = z.infer<typeof incidentSchema>;

export const incidentEventSchema = z.object({
  id: z.number(),
  time: timestamp,
  kind: z.enum([
    "opened",
    "escalated",
    "deescalated",
    "acknowledged",
    "note",
    "resolved",
    "reopened",
  ]),
  actor: z.string().nullable(),
  message: z.string().nullable(),
});

export const suppressionSchema = z.object({
  id: z.string(),
  kind: z.enum(["maintenance", "silence"]),
  serviceId: z.string().nullable(),
  serviceName: z.string().nullable(),
  startsAt: timestamp,
  endsAt: timestamp,
  reason: z.string().nullable(),
  createdBy: z.string().nullable(),
});
export type SuppressionView = z.infer<typeof suppressionSchema>;

export const activityItemSchema = z.object({
  id: z.number(),
  signalId: z.string(),
  type: z.string(),
  time: timestamp,
  summary: z.string().nullable(),
  /** How many repeats of this signal were folded into the entry. */
  count: z.number(),
});
export type ActivityItem = z.infer<typeof activityItemSchema>;

const countsSchema = z.object({
  healthy: z.number(),
  warning: z.number(),
  unavailable: z.number(),
  unknown: z.number(),
});

export const fleetItemSchema = serviceSummarySchema.extend({
  /** Accepted health after debouncing; `unknown` until first checked. */
  health: healthSchema,
  since: timestamp.nullable(),
  lastCheckedAt: timestamp.nullable(),
  nextCheckAt: timestamp.nullable(),
  detail: z.string().optional(),
  latencyMs: z.number().optional(),
  score: z.number().optional(),
  availability7d: z.number().nullable(),
  strip: z.array(stripBucketSchema),
  incidentId: z.string().nullable(),
  maintenance: z.boolean(),
});
export type FleetItem = z.infer<typeof fleetItemSchema>;

/** Health of every visible service, read from recorded results. */
export const fleetSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  items: z.array(fleetItemSchema),
  counts: countsSchema,
  activeIncidents: z.number(),
  availability7d: z.number().nullable(),
});
export type Fleet = z.infer<typeof fleetSchema>;

export const rangeStatsSchema = z.object({
  days: z.number(),
  availability: z.number().nullable(),
  healthyShare: z.number().nullable(),
  measured: z.number(),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  p99: z.number().nullable(),
  averageLatencyMs: z.number().nullable(),
});

export const budgetSchema = z.object({
  targetPercent: z.number(),
  windowDays: z.number(),
  availability: z.number().nullable(),
  budgetPercent: z.number(),
  consumedPercent: z.number().nullable(),
  remainingFraction: z.number().nullable(),
  met: z.boolean().nullable(),
});

export const serviceDetailSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  service: serviceSummarySchema,
  state: z
    .object({
      health: healthSchema,
      since: timestamp,
      lastCheckedAt: timestamp,
      nextCheckAt: timestamp,
      detail: z.string().optional(),
      latencyMs: z.number().optional(),
      score: z.number().optional(),
      checks: z.array(checkSchema),
      maintenance: z.boolean(),
      silenced: z.boolean(),
    })
    .nullable(),
  ranges: z.array(rangeStatsSchema),
  slo: z
    .object({
      source: z.enum(["configuration", "ui"]),
      budget: budgetSchema,
    })
    .nullable(),
  /** Hourly buckets for the last seven days. */
  strip: z.array(stripBucketSchema),
  /** Daily buckets for the last ninety days. */
  daily: z.array(
    stripBucketSchema.extend({ availability: z.number().nullable() }),
  ),
  /** Average and 95th percentile latency per hour for the last seven days. */
  latency: z.array(
    z.object({
      time: timestamp,
      average: z.number().nullable(),
      p95: z.number().nullable(),
    }),
  ),
  transitions: z.array(
    z.object({
      checkId: z.string(),
      label: z.string(),
      time: timestamp,
      ok: z.boolean(),
      detail: z.string().nullable(),
    }),
  ),
  incidents: z.array(incidentSchema),
  suppressions: z.array(suppressionSchema),
  /** Signals from other sources for this service in the last seven days. */
  activity: z.array(activityItemSchema),
});
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;

export const incidentListSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  items: z.array(incidentSchema),
  active: z.number(),
  resolvedLast30Days: z.number(),
  meanTimeToResolveMs: z.number().nullable(),
});
export type IncidentList = z.infer<typeof incidentListSchema>;

export const incidentDetailSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  incident: incidentSchema,
  events: z.array(incidentEventSchema),
  serviceHealth: healthSchema,
  /**
   * Signals from other sources for the same service shortly before and after
   * the incident opened, with their offset from it in milliseconds
   * (negative is before).
   */
  around: z.array(activityItemSchema.extend({ offsetMs: z.number() })),
});
export type IncidentDetail = z.infer<typeof incidentDetailSchema>;

export const suppressionListSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  items: z.array(suppressionSchema),
});
export type SuppressionList = z.infer<typeof suppressionListSchema>;

export const periodSchema = z.object({
  from: z.number(),
  to: z.number(),
  availability: z.number().nullable(),
  incidentsOpened: z.number(),
  incidentsResolved: z.number(),
  meanTimeToResolveMs: z.number().nullable(),
  longestIncidentMs: z.number().nullable(),
});
export type Period = z.infer<typeof periodSchema>;

export const reportServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  adapter: z.string(),
  availability: z.number().nullable(),
  previousAvailability: z.number().nullable(),
  incidents: z.number(),
});

export const reportSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: z.number(),
  days: z.number(),
  current: periodSchema,
  previous: periodSchema,
  /** Services ordered worst first. */
  services: z.array(reportServiceSchema),
});
export type Report = z.infer<typeof reportSchema>;
