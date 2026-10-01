/**
 * Health of every configured service, as a declared resource.
 *
 * The overview page reads this, so the page holds no timer: the host refreshes
 * it on the declared interval and the browser re-renders. A single resource
 * rather than one per service, because the probes are one batch and splitting
 * them would fire a request per service instead of one.
 */
import {
  defineResource,
  type PluginContext,
  poll,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import {
  countHealth,
  healthSchema,
  joinProbes,
  probeServices,
  serviceSummarySchema,
} from "../context.js";

/** The plugin's own config, as the resources read it. */
type HealthConfig = { timeoutMs: number; maxServices: number };
type HealthContext = PluginContext<HealthConfig>;

/**
 * What the summary resource returns.
 *
 * Typed from the plugin's own service and health schemas so the browser and the
 * page see the same row shape the join produced, rather than an open object.
 */
const healthRowSchema = serviceSummarySchema.extend({
  health: healthSchema,
  detail: z.string().optional(),
  latencyMs: z.number().optional(),
});

export const summaryOutputSchema = z.object({
  items: z.array(healthRowSchema),
  counts: z.object({
    healthy: z.number(),
    warning: z.number(),
    unavailable: z.number(),
    unknown: z.number(),
  }),
});

export type HealthSummary = z.infer<typeof summaryOutputSchema>;

/**
 * Probes every service and summarises the results.
 *
 * `poll` is what makes the health page current without the page asking: the
 * interval matches the slowest useful reading, since a health summary is only
 * meaningful once its slowest service has answered.
 */
export const serviceHealth = defineResource({
  id: "service-health",
  input: z.object({}).optional(),
  query: async (_input, context: HealthContext) => {
    const { items } = await context.services.list({
      limit: context.config.maxServices,
    });
    const probes = await probeServices(
      (id) =>
        context.services.probe(id, { timeoutMs: context.config.timeoutMs }),
      items,
    );
    const results = joinProbes(items, probes);
    return { items: results, counts: countHealth(results) };
  },
  refresh: poll("10s"),
});

/** A single service's probe, for a detail view. */
export const serviceProbe = defineResource({
  id: "service-probe",
  input: z.object({ id: z.string().min(1) }),
  query: async (input, context: HealthContext) =>
    context.services.probe(input.id, {
      timeoutMs: context.config.timeoutMs,
    }),
  refresh: poll("5s"),
});
