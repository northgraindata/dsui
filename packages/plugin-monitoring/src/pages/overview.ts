/**
 * Host resource overview.
 *
 * Numbers first, because a reading someone needs right now should not wait for
 * a chart to load, and charts below for the trend. Every reading comes from a
 * declared resource, so the host owns refresh: the page holds no timer and does
 * not fan out a request per metric on every render.
 */
import {
  Card,
  Chart,
  type ChartWindow,
  definePage,
  Grid,
  PageHeader,
  type PluginContext,
  type PluginResourceReader,
  Section,
} from "@northgraindata/dsui-plugin-sdk";
import { metric } from "../components/metric.js";
import { statusNote } from "../components/status.js";
import { formatBytes } from "../context.js";
import {
  type CpuSample,
  type DiskSample,
  hostCpu,
  hostDisk,
  hostMemory,
  type MemorySample,
} from "../resources/host.js";
import { WINDOWS } from "../stores/series.js";

/** The plugin's own config, as the overview page reads it. */
type MonitoringConfig = {
  paths: { path: string; mount: string }[];
  maxVolumes: number;
};

/**
 * Windows offered to the chart.
 *
 * Built from the shared list so the chart buttons, the resource validation and
 * the retention policy cannot drift apart.
 */
const windows: ChartWindow[] = WINDOWS.map((window) => ({
  label: window.label,
  secs: window.secs,
}));

export const overviewPage = definePage<
  "/monitoring",
  PluginContext<MonitoringConfig>
>({
  path: "/monitoring",
  render: async ({ context, resource }) => {
    const volumes = context.config.paths.slice(0, context.config.maxVolumes);
    return renderOverview({ paths: volumes, resource });
  },
});

/**
 * Reads every resource it draws from before building nodes.
 *
 * `resource()` may return a promise — a query that touches the filesystem is
 * async — and the nodes below index straight into the results, so each read is
 * awaited. Casting the promise to the result type instead would put a Promise
 * where the page expects an array and fail at the first `.map`.
 */
async function renderOverview(input: {
  paths: readonly { path: string; mount: string }[];
  resource: PluginResourceReader;
}) {
  const cpu = (await input.resource(hostCpu)) as CpuSample;
  const memory = (await input.resource(hostMemory)) as MemorySample;
  const disks = (await input.resource(hostDisk, {
    paths: input.paths,
  })) as readonly DiskSample[];

  const [oneMinute] = cpu.loadAverage;
  // Load average is only meaningful relative to available parallelism; a busy
  // single-core container and a busy 64-core host are not the same number.
  const loadPerCore = cpu.cores === 0 ? 0 : oneMinute / cpu.cores;

  return [
    PageHeader({
      title: "Host resources",
      description: `Load ${oneMinute.toFixed(2)} · ${formatBytes(memory.usedBytes)} of ${formatBytes(memory.totalBytes)} memory`,
    }),
    Section({
      title: "Now",
      content: Grid({
        columns: 3,
        content: [
          metric({
            label: "Load per core",
            value: loadPerCore.toFixed(2),
            hint: `${oneMinute.toFixed(2)} over ${cpu.cores} cores`,
          }),
          metric({
            label: "Memory",
            value: `${memory.usedPercent.toFixed(0)}%`,
            hint: `${formatBytes(memory.usedBytes)} of ${formatBytes(memory.totalBytes)}`,
          }),
          metric({
            label: "Volumes",
            value: String(disks.length),
            hint: disks.length
              ? disks.map((disk) => disk.mount).join(" · ")
              : "none sampled",
          }),
        ],
      }),
    }),
    disks.length === 0
      ? statusNote({
          text: "None of the configured paths could be sampled.",
        })
      : Section({
          title: "Volumes",
          content: Grid({
            columns: 2,
            content: disks.map((disk) =>
              metric({
                label: disk.mount,
                value: formatBytes(disk.totalBytes - disk.freeBytes),
                hint: `of ${formatBytes(disk.totalBytes)} · ${disk.usedPercent.toFixed(0)}% used`,
              }),
            ),
          }),
        }),
    Section({
      title: "History",
      content: Grid({
        columns: 1,
        content: [
          Card({
            title: "Load per core",
            description: "One sample per second, kept for seven days.",
            content: Chart({
              source: seriesSource("host-cpu-series"),
              windows,
              label: "Load per core over time",
              referenceLine: { value: 1, label: "one core busy" },
            }),
          }),
          Card({
            title: "Memory used",
            description: "Percentage of total, so it reads against disk.",
            content: Chart({
              source: seriesSource("host-memory-series"),
              windows,
              label: "Memory used over time",
            }),
          }),
        ],
      }),
    }),
  ];
}

/** Chart reads bind a resource by id, with the window as input. */
function seriesSource(resourceId: string) {
  return {
    kind: "resource-binding" as const,
    resourceId,
    input: { window: "1h" },
    refresh: { kind: "poll" as const, intervalMs: 2_000 },
  };
}

export type { MonitoringConfig, PluginContext };
