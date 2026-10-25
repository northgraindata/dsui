import {
  defineJob,
  definePage,
  definePlugin,
  KeyValue,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import {
  acknowledge,
  addNote,
  addSuppression,
  checkNow,
  removeSlo,
  removeSuppression,
  resolve,
  setSlo,
} from "./actions.js";
import { serviceCardSlot } from "./components/slots.js";
import { configSchema, SCHEDULER_TICK_MS } from "./config.js";
import type { ServiceSummary } from "./context.js";
import { fleetSchema } from "./contract.js";
import { openHealthDb } from "./db.js";
import { emitWeeklyReport } from "./digest.js";
import {
  incidentPage,
  incidentsPage,
  overviewPage,
  servicePage,
} from "./pages/index.js";
import { resources } from "./resources/health.js";
import { registerSignals } from "./signals.js";
import { runTick } from "./tick.js";
import { buildFleet, listServices } from "./view.js";

/**
 * Built-in service health plugin.
 *
 * Health is a cross-service concern rather than a property of any single
 * adapter, so it is a plugin rather than part of the core service contract.
 * Each adapter decides what healthy means for its system. The host owns
 * connection decryption and the actual probe. This plugin owns scheduling,
 * history, interpretation, incidents and presentation, and treats the checks
 * an adapter reports as opaque data: it never branches on an adapter.
 *
 * The plugin is disableable (`plugins.health.enabled: false`) and DSUI works
 * the same without it.
 */
export function createHealthPlugin() {
  return definePlugin({
    metadata: {
      id: "health",
      name: "Service health",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema,
    setup(registry, config) {
      registry.job(
        defineJob({
          id: "scheduler",
          intervalMs: SCHEDULER_TICK_MS,
          concurrency: "singleton",
          // A tick may have to wait out the slowest adapter in every wave of
          // probes, so the budget scales with how many probes it can start.
          timeoutMs:
            Math.ceil(config.maxServices / config.maxConcurrentProbes) *
              config.timeoutMs +
            15_000,
          retry: { maxAttempts: 1 },
          run: async ({ context }) => {
            await runTick(
              {
                config,
                services: context.services,
                storage: context.storage,
                events: context.events,
                logger: context.logger,
              },
              { signal: context.signal },
            );
            context.signal.throwIfAborted();
          },
        }),
      );

      registry.job(
        defineJob({
          id: "weekly-report",
          // Monday morning, server time.
          schedule: "0 8 * * 1",
          concurrency: "singleton",
          timeoutMs: 60_000,
          retry: { maxAttempts: 2 },
          run: async ({ context }) => {
            await emitWeeklyReport({
              config,
              services: context.services,
              storage: context.storage,
              events: context.events,
            });
          },
        }),
      );

      registerSignals(registry);
      for (const resource of resources) registry.resource(resource);
      registry.action(checkNow);
      registry.action(acknowledge);
      registry.action(addNote);
      registry.action(resolve);
      registry.action(setSlo);
      registry.action(removeSlo);
      registry.action(addSuppression);
      registry.action(removeSuppression);

      // Kept for a browser that asks for the summary directly, e.g. a command
      // palette action with no page to render. Reads recorded results.
      registry.procedure({
        id: "summary",
        permission: "inspect",
        input: z.object({}).optional(),
        output: fleetSchema,
        handler: async (context) =>
          buildFleet(
            openHealthDb(context.storage),
            await listServices(context.services, config.maxServices),
            Date.now(),
          ),
      });

      registry.page(overviewPage, {
        id: "overview",
        title: "Service health",
        description: "Current status, uptime and incidents for every service.",
      });
      registry.page(servicePage, {
        id: "service",
        title: "Service health",
      });
      registry.page(incidentsPage, {
        id: "incidents",
        title: "Incidents",
        description: "Incidents and maintenance across your services.",
      });
      registry.page(incidentPage, { id: "incident", title: "Incident" });

      registry.page(
        definePage({
          path: "/settings",
          render: () =>
            KeyValue({
              title: "Service health configuration",
              data: {
                "Default check interval": `${config.defaultIntervalMs / 60_000} minutes`,
                "Probe timeout": `${config.timeoutMs / 1000} seconds`,
                "Failures before unhealthy": config.failureThreshold,
                "Successes before recovered": config.recoveryThreshold,
                "Concurrent probes": `${config.maxConcurrentProbes} total, ${config.maxConcurrentProbesPerAdapter} per adapter`,
                "Maximum services": config.maxServices,
                "Raw sample retention": `${config.rawRetentionDays} days`,
                "Daily history retention": `${config.rollupRetentionDays} days`,
                "Per-service overrides": Object.keys(config.services).length,
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
      registry.navigation({
        id: "health-incidents",
        area: "secondary",
        label: "Incidents",
        pageId: "incidents",
        order: 51,
      });

      registry.slot(serviceCardSlot);
    },
  });
}

export default createHealthPlugin();
export type { ServiceSummary };
