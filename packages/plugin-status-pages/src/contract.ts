import { z } from "zod";
export const CONTRACT_VERSION = 1;
const timestamp = z.number().finite();
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
  healthAvailable: z.boolean().optional(),
  healthError: z.string().optional(),
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
  healthAvailable: z.boolean().optional(),
  healthError: z.string().optional(),
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

export const servicesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      adapter: z.string(),
      iconUrl: z.string().optional(),
    }),
  ),
});
