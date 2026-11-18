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
export const outageSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  adapter: z.string(),
  severity: severitySchema,
  peakSeverity: severitySchema,
  summary: z.string(),
  detail: z.string().nullable(),
  startedAt: timestamp,
  /** `null` while the outage is ongoing. */
  endedAt: timestamp.nullable(),
});
export type OutageView = z.infer<typeof outageSchema>;

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
  /** The ongoing outage, if any. */
  outageId: z.string().nullable(),
  maintenance: z.boolean(),
});
export type FleetItem = z.infer<typeof fleetItemSchema>;

/** Health of every visible service, read from recorded results. */
export const fleetSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  items: z.array(fleetItemSchema),
  counts: countsSchema,
  activeOutages: z.number(),
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
  /** Outages in the last ninety days, newest first. */
  outages: z.array(outageSchema),
  suppressions: z.array(suppressionSchema),
});
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;

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
  outagesStarted: z.number(),
  outagesEnded: z.number(),
  meanTimeToRecoverMs: z.number().nullable(),
  longestOutageMs: z.number().nullable(),
});
export type Period = z.infer<typeof periodSchema>;

export const reportServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  adapter: z.string(),
  availability: z.number().nullable(),
  previousAvailability: z.number().nullable(),
  outages: z.number(),
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

export const componentStatusSchema = z.enum([
  "operational",
  "maintenance",
  "degraded",
  "partial-outage",
  "major-outage",
  "unknown",
]);
export type ComponentStatusView = z.infer<typeof componentStatusSchema>;

export const noticeImpactSchema = z.enum([
  "operational",
  "maintenance",
  "degraded",
  "partial-outage",
  "major-outage",
]);
export const noticeStatusSchema = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

export const statusPageSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: componentStatusSchema,
  components: z.number(),
  activeNotices: z.number(),
  updatedAt: timestamp,
});
export type StatusPageSummary = z.infer<typeof statusPageSummarySchema>;

export const statusPageListSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  items: z.array(statusPageSummarySchema),
  /** Whether the requester may create status pages. */
  canCreate: z.boolean(),
});
export type StatusPageList = z.infer<typeof statusPageListSchema>;

export const statusComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  serviceIds: z.array(z.string()),
  status: componentStatusSchema,
  availability: z.number().nullable(),
  days: z.array(
    z.object({
      time: timestamp,
      status: componentStatusSchema.nullable(),
      availability: z.number().nullable(),
    }),
  ),
});
export type StatusComponentView = z.infer<typeof statusComponentSchema>;

export const noticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  impact: noticeImpactSchema,
  status: noticeStatusSchema,
  componentIds: z.array(z.string()),
  source: z.string().nullable(),
  createdAt: timestamp,
  resolvedAt: timestamp.nullable(),
  updates: z.array(
    z.object({
      id: z.number(),
      time: timestamp,
      status: noticeStatusSchema,
      message: z.string(),
      author: z.string().nullable(),
    }),
  ),
});
export type NoticeView = z.infer<typeof noticeSchema>;

export const statusPageDetailSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  page: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    updatedAt: timestamp,
  }),
  status: componentStatusSchema,
  components: z.array(statusComponentSchema),
  /** Notices that are not resolved yet, newest first. */
  active: z.array(noticeSchema),
  /** Notices resolved in the last 30 days, newest first. */
  history: z.array(noticeSchema),
  /** What the requester may do on this page. */
  can: z.object({ edit: z.boolean(), post: z.boolean() }),
});
export type StatusPageDetail = z.infer<typeof statusPageDetailSchema>;
