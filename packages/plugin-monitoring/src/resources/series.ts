/**
 * Host resource series, declared so a chart can read them.
 *
 * Sampling is one reading every ten seconds, appended to indexed SQLite records. A query returns the series already averaged to the requested window,
 * so the browser draws at most a few thousand points regardless of how much
 * history is retained.
 */
import {
  type DiagnosticSnapshot,
  defineResource,
  type PluginContext,
  type PluginStorage,
  poll,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import {
  type DiskSample,
  sampleCpu,
  sampleDisk,
  sampleMemory,
} from "../context.js";
import { runtimeMetrics } from "../runtime-metrics.js";
import {
  readWindow,
  recordOperations,
  recordRuntime,
  recordSample,
} from "../stores/history.js";
import { appendDiagnostic } from "../stores/log.js";
import { WINDOWS } from "../stores/series.js";

/** The plugin's own config, as the series resources read it. */
type MonitoringConfig = {
  paths: { path: string; mount: string }[];
  maxVolumes: number;
};

type Ctx = PluginContext<MonitoringConfig>;

/** The windows a chart may ask for. */
export const chartWindows = z.enum(["5m", "1h", "24h", "7d"]);

/** Background collection cadence, independent of page views. */
export const LIVE_INTERVAL_MS = 10_000;

/**
 * Load average, sampled every ten seconds.
 *
 * A single series rather than one per core: the chart's axis has one meaning,
 * and a caller wanting per-core detail wants a different question answered.
 */
export const hostCpuSeries = defineResource({
  id: "host-cpu-series",
  input: z.object({ window: chartWindows.default("1h") }),
  query: (input, context: Ctx) =>
    readWindow(
      context.storage,
      "cpu",
      windowSeconds(input.window),
      input.window,
    ),
  refresh: poll("10s"),
});

/** Memory used, as a percentage so it shares an axis with disk. */
export const hostMemorySeries = defineResource({
  id: "host-memory-series",
  input: z.object({ window: chartWindows.default("1h") }),
  query: (input, context: Ctx) =>
    readWindow(
      context.storage,
      "memory",
      windowSeconds(input.window),
      input.window,
    ),
  refresh: poll("10s"),
});

/** Disk usage percent, averaged across the configured volumes. */
export const hostDiskSeries = defineResource({
  id: "host-disk-series",
  input: z.object({ window: chartWindows.default("1h") }),
  query: (input, context: Ctx) =>
    readWindow(
      context.storage,
      "disk",
      windowSeconds(input.window),
      input.window,
    ),
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
  storage: PluginStorage,
  volumes: readonly MonitoringConfig["paths"][number][],
  diagnostics?: DiagnosticSnapshot,
): Promise<void> {
  const time = Date.now();
  const runtime = runtimeMetrics();
  const cpu = sampleCpu();
  const memory = sampleMemory();
  const [oneMinute] = cpu.loadAverage;

  const samples = await Promise.all(
    volumes.map(async (volume) => sampleDisk(volume.path, volume.mount)),
  );
  const usable = samples.filter(
    (sample): sample is DiskSample => sample !== null,
  );
  const disk = usable.length
    ? usable.reduce((sum, sample) => sum + sample.usedPercent, 0) /
      usable.length
    : null;
  recordSample(storage, {
    time,
    cpu: oneMinute,
    memory: memory.usedPercent,
    disk,
  });
  recordOperations(storage, diagnostics?.operations ?? [], time);
  recordRuntime(storage, time, {
    ...runtime,
    memoryUsedPercent: memory.usedPercent,
    loadAverage: cpu.loadAverage,
  });
  const directory = storage.directory?.();
  if (directory)
    await appendDiagnostic(
      directory,
      {
        type: "resource",
        ...runtime,
        diagnostics,
        loadAverage: cpu.loadAverage,
        memoryUsedPercent: memory.usedPercent,
        memoryUsedBytes: memory.usedBytes,
        processMemory: process.memoryUsage(),
        processCpu: process.cpuUsage(),
        processUptimeSeconds: process.uptime(),
        diskUsedPercent: disk,
      },
      time,
    );
}
