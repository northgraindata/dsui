import { homedir, tmpdir } from "node:os";
import { definePlugin } from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import {
  sampleCpu,
  sampleMemory,
  sampleProcessMemory,
  sampleUptime,
  sampleVolumes,
} from "./context.js";
import { overviewPage } from "./pages/overview.js";
import { hostCpu, hostDisk, hostMemory } from "./resources/host.js";
import {
  hostCpuSeries,
  hostDiskSeries,
  hostMemorySeries,
  LIVE_INTERVAL_MS,
  sampleAll,
} from "./resources/series.js";

/**
 * Built-in host resource monitoring.
 *
 * Reports CPU load, memory and disk for the machine running DSUI. It is a
 * separate plugin from health on purpose: what the host can observe is not what
 * "healthy" means. Health decides how a full disk or a saturated CPU affects a
 * given service — and only for services whose data actually lives on this
 * machine — while this plugin reports the numbers.
 *
 * The split is what keeps both extensible. A deployment can disable this plugin
 * and still get adapter-reported health, and a deployment can add a monitoring
 * plugin that knows about metrics DSUI has never heard of, without changing the
 * host.
 */

const volumeSchema = z.object({
  path: z.string().min(1),
  mount: z.string().min(1),
});

const configSchema = z.object({
  /**
   * Paths to sample for free space, with the label shown for each.
   *
   * Defaults to the temporary and home directories, which between them cover
   * the volumes a DSUI install usually writes to.
   */
  paths: z.array(volumeSchema).default(() => [
    { path: tmpdir(), mount: "/tmp" },
    { path: homedir(), mount: "~" },
  ]),
  /** Upper bound on volumes sampled per request. */
  maxVolumes: z.number().int().positive().max(32).default(16),
});

export const sampleOutputSchema = z.object({
  loadAverage: z.array(z.number()),
  cores: z.number(),
  memoryUsedBytes: z.number(),
  memoryTotalBytes: z.number(),
  memoryUsedPercent: z.number(),
  processMemoryBytes: z.number(),
  uptimeSeconds: z.number(),
  disk: z.array(
    z.object({
      mount: z.string(),
      totalBytes: z.number(),
      freeBytes: z.number(),
      usedPercent: z.number(),
    }),
  ),
});

/**
 * The active sampling timer.
 *
 * Module-scoped because `start` and `stop` are separate hooks with no shared
 * instance to hang state on, and exactly one monitoring plugin can be active.
 */
let sampler: ReturnType<typeof setInterval> | undefined;

export function createMonitoringPlugin() {
  return definePlugin({
    metadata: {
      id: "monitoring",
      name: "Host monitoring",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema,
    setup(registry, config) {
      const volumes = config.paths.slice(0, config.maxVolumes);

      // Declared so the host can refresh them on their own intervals; the page
      // reads them through its render context.
      registry.resource(hostCpu);
      registry.resource(hostMemory);
      registry.resource(hostDisk);

      // The historical series behind the charts, and the sampler that fills
      // them. Sampling is a timer rather than a render, so history accumulates
      // whether or not anyone is looking at the page.
      registry.resource(hostCpuSeries);
      registry.resource(hostMemorySeries);
      registry.resource(hostDiskSeries);

      registry.procedure({
        id: "sample",
        permission: "inspect",
        input: z.object({}).optional(),
        output: sampleOutputSchema,
        handler: async () => {
          const cpu = sampleCpu();
          const memory = sampleMemory();
          return {
            loadAverage: [...cpu.loadAverage],
            cores: cpu.cores,
            memoryUsedBytes: memory.usedBytes,
            memoryTotalBytes: memory.totalBytes,
            memoryUsedPercent: memory.usedPercent,
            processMemoryBytes: sampleProcessMemory(),
            uptimeSeconds: sampleUptime(),
            disk: await sampleVolumes(volumes),
          };
        },
      });

      registry.page(overviewPage, {
        id: "overview",
        title: "Host resources",
        description: "CPU load, memory and disk for the machine running DSUI.",
      });

      registry.navigation({
        id: "monitoring-overview",
        area: "secondary",
        label: "Host resources",
        pageId: "overview",
        order: 60,
      });
    },

    /**
     * Records one sample of every series per second.
     *
     * Started by the host after setup so history accumulates even when nobody
     * opens the page, which is the whole point of keeping seven days: the data
     * for a window that is opened later has to already exist. The timer is
     * unref'd so a sampling DSUI can still exit.
     */
    async start(context) {
      await sampleAll(context);
      const timer = setInterval(() => {
        void sampleAll(context).catch((error: unknown) => {
          context.logger.warn("Failed to sample host resources", {
            detail: error instanceof Error ? error.message : "unknown",
          });
        });
      }, LIVE_INTERVAL_MS);
      if (typeof timer === "object" && timer !== null && "unref" in timer)
        (timer as unknown as { unref(): void }).unref();
      sampler = timer;
    },

    async stop() {
      if (sampler) clearInterval(sampler);
      sampler = undefined;
    },
  });
}

export default createMonitoringPlugin();
