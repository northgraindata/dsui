/**
 * Host resource series, declared so a chart can read them.
 *
 * Sampling is one reading per second per series, recorded into a persistent
 * store. A query returns the series already averaged to the requested window,
 * so the browser draws at most a few thousand points regardless of how much
 * history is retained.
 */
import {
  defineResource,
  type PluginContext,
  type PluginStores,
  poll,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import {
  type DiskSample,
  sampleCpu,
  sampleDisk,
  sampleMemory,
} from "../context.js";
import {
  cpuSeries,
  diskPercentSeries,
  memoryPercentSeries,
  readSeries,
  WINDOWS,
} from "../stores/series.js";

/** The plugin's own config, as the series resources read it. */
type MonitoringConfig = {
  paths: { path: string; mount: string }[];
  maxVolumes: number;
};

type Ctx = PluginContext<MonitoringConfig>;

/** The windows a chart may ask for. */
export const chartWindows = z.enum(["5m", "1h", "24h", "7d"]);

/** The 5-minute window, in seconds. */
export const LIVE_INTERVAL_MS = 1_000;

/**
 * Load average, sampled once a second.
 *
 * A single series rather than one per core: the chart's axis has one meaning,
 * and a caller wanting per-core detail wants a different question answered.
 */
export const hostCpuSeries = defineResource({
  id: "host-cpu-series",
  input: z.object({ window: chartWindows.default("1h") }),
  query: (input, context: Ctx) => {
    const points = context.stores.get(cpuSeries).get().points;
    return readSeries(points, windowSeconds(input.window));
  },
  refresh: poll("2s"),
});

/** Memory used, as a percentage so it shares an axis with disk. */
export const hostMemorySeries = defineResource({
  id: "host-memory-series",
  input: z.object({ window: chartWindows.default("1h") }),
  query: (input, context: Ctx) =>
    readSeries(
      context.stores.get(memoryPercentSeries).get().points,
      windowSeconds(input.window),
    ),
  refresh: poll("2s"),
});

/** Disk usage percent, averaged across the configured volumes. */
export const hostDiskSeries = defineResource({
  id: "host-disk-series",
  input: z.object({ window: chartWindows.default("1h") }),
  query: async (input, context: Ctx) => {
    const points = context.stores.get(diskPercentSeries).get().points;
    return readSeries(points, windowSeconds(input.window));
  },
  refresh: poll("10s"),
});

function windowSeconds(label: string): number {
  return WINDOWS.find((window) => window.label === label)?.secs ?? 3_600;
}

/**
 * Records one sample of every series.
 *
 * Called on a timer rather than on render, so a page nobody is looking at still
 * accumulates history. That is the point of a series: the seven days are there
 * to be read later.
 */
export async function sampleAll(
  stores: PluginStores,
  volumes: readonly MonitoringConfig["paths"][number][],
): Promise<void> {
  const time = Date.now();
  const cpu = sampleCpu();
  const memory = sampleMemory();
  const [oneMinute] = cpu.loadAverage;

  stores.get(cpuSeries).actions.append(oneMinute, time);
  stores.get(memoryPercentSeries).actions.append(memory.usedPercent, time);

  const samples = await Promise.all(
    volumes.map(async (volume) => sampleDisk(volume.path, volume.mount)),
  );
  const usable = samples.filter(
    (sample): sample is DiskSample => sample !== null,
  );
  if (usable.length)
    stores
      .get(diskPercentSeries)
      .actions.append(
        usable.reduce((sum, sample) => sum + sample.usedPercent, 0) /
          usable.length,
        time,
      );
}
