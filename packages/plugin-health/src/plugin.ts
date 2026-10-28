import {
  defineJob,
  definePage,
  definePlugin,
  KeyValue,
  type PluginContext,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import { serviceCardSlot } from "./components/slots.js";
import {
  countHealth,
  joinProbes,
  MAX_CONCURRENT_PROBES,
  probeServices,
  type ServiceSummary,
} from "./context.js";
import { recordChecks } from "./history.js";
import { healthOverviewPage } from "./pages/overview.js";
import {
  summaryOutputSchema as healthSummarySchema,
  serviceHealth,
  serviceProbe,
} from "./resources/health.js";

/**
 * Built-in service health plugin.
 *
 * Health is a cross-service concern rather than a property of any single
 * adapter, so it is a plugin rather than part of the core service contract.
 * The host owns connection decryption and the actual adapter probe; this
 * plugin owns interpretation, aggregation and presentation.
 *
 * The plugin ships with DSUI but is disableable (`plugins.health.enabled:
 * false`), because health has a real cost — one probe per service — that not
 * every deployment wants to pay on every dashboard load.
 */

type Config = z.infer<typeof configSchema>;
const configSchema = z.object({
  /** Upper bound on a single probe, forwarded to the host. */
  checkIntervalMs: z
    .number()
    .int()
    .min(10_000)
    .max(3_600_000)
    .default(3_600_000),
  timeoutMs: z.number().int().positive().max(60_000).default(30_000),
  /** Maximum services probed per batch. */
  maxServices: z.number().int().positive().max(500).default(100),
});

async function batch(
  context: PluginContext<Config>,
): Promise<z.infer<typeof healthSummarySchema>> {
  const { items } = await context.services.list({
    limit: context.config.maxServices,
  });
  const probes = await probeServices(
    (id) => context.services.probe(id, { timeoutMs: context.config.timeoutMs }),
    items,
  );
  const results = joinProbes(items, probes);
  return { items: results, counts: countHealth(results) };
}

export function createHealthPlugin() {
  return definePlugin({
    metadata: {
      id: "health",
      name: "Service health",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema: configSchema,
    setup(registry, config) {
      registry.job(
        defineJob({
          id: "check-services",
          intervalMs: config.checkIntervalMs,
          concurrency: "singleton",
          timeoutMs:
            Math.ceil(config.maxServices / MAX_CONCURRENT_PROBES) *
              config.timeoutMs +
            5_000,
          retry: { maxAttempts: 1 },
          run: async ({ context }) => {
            const { items } = await context.services.list({
              limit: config.maxServices,
            });
            const probes = await probeServices(
              (id) =>
                context.services.probe(id, { timeoutMs: config.timeoutMs }),
              items,
            );
            context.signal.throwIfAborted();
            recordChecks(context.storage, joinProbes(items, probes));
          },
        }),
      );
      // Declared so the host refreshes them; the page reads them rather than
      // probing on every render.
      registry.resource(serviceHealth);
      registry.resource(serviceProbe);

      // Kept for a browser that asks for the summary directly, e.g. a command
      // palette action with no page to render.
      registry.procedure({
        id: "summary",
        permission: "inspect",
        input: z.object({}).optional(),
        output: healthSummarySchema,
        handler: (context) => batch(context),
      });

      registry.page(healthOverviewPage, {
        id: "overview",
        title: "Service health",
        description:
          "Reachability and response time for every configured service.",
      });

      registry.page(
        definePage({
          path: "/settings",
          render: () =>
            KeyValue({
              title: "Service health configuration",
              data: {
                "Background check interval": `${config.checkIntervalMs / 60_000} minutes`,
                "Probe timeout": `${config.timeoutMs / 1000} seconds`,
                "Maximum services": config.maxServices,
                "History window": "7 days · one bar per hour",
                "Status interpretation":
                  "Reported by each adapter; latency alone does not mean unavailable",
                Configuration:
                  "Edit plugins.health.config in dsui.yaml, then restart DSUI",
              },
            }),
        }),
        {
          id: "settings",
          title: "Service health settings",
          settings: {
            category: "Monitoring",
            label: "Service health",
            permission: "manage",
          },
        },
      );

      registry.navigation({
        id: "health-overview",
        area: "secondary",
        label: "Service health",
        pageId: "overview",
        order: 50,
      });

      registry.slot(serviceCardSlot);
    },
  });
}

export default createHealthPlugin();
export type { ServiceSummary };
