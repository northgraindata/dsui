import {
  Card,
  Chart,
  type ChartWindow,
  Collection,
  Columns,
  definePage,
  Grid,
  KeyValue,
  Meter,
  type PluginContext,
  type PluginResourceReader,
  Resource,
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
  hostRuntime,
  type MemorySample,
} from "../resources/host.js";
import { WINDOWS } from "../stores/series.js";

type MonitoringConfig = {
  paths: { path: string; mount: string }[];
  maxVolumes: number;
};
const windows: ChartWindow[] = WINDOWS.map(({ label, secs }) => ({
  label,
  secs,
}));

export const overviewPage = definePage<
  "/monitoring",
  PluginContext<MonitoringConfig>
>({
  path: "/monitoring",
  render: async ({ context, resource }) =>
    renderOverview({
      paths: context.config.paths.slice(0, context.config.maxVolumes),
      resource,
    }),
});

async function renderOverview(input: {
  paths: readonly { path: string; mount: string }[];
  resource: PluginResourceReader;
}) {
  const cpu = (await input.resource(hostCpu)) as CpuSample;
  const memory = (await input.resource(hostMemory)) as MemorySample;
  const runtime = (await input.resource(hostRuntime)) as Awaited<
    ReturnType<typeof hostRuntime.query>
  >;
  const disks = input.paths.length
    ? ((await input.resource(hostDisk, {
        paths: input.paths,
      })) as readonly DiskSample[])
    : [];
  const busiest = [...disks].sort((a, b) => b.usedPercent - a.usedPercent)[0];
  return [
    Resource({
      source: {
        kind: "resource-binding",
        resourceId: "host-overview",
        input: {},
        refresh: { kind: "poll", intervalMs: 5_000 },
      },
      content: [
        Grid({
          content: [
            metric({
              icon: "cpu",
              label: "CPU load",
              field: "cpu",
              value: cpu.loadAverage[0].toFixed(2),
              hint: `1-minute average · ${cpu.cores} logical cores`,
            }),
            metric({
              icon: "layers",
              label: "Memory used",
              field: "memory",
              value: `${memory.usedPercent.toFixed(0)}%`,
              hint: { field: "memoryHint" },
            }),
            metric({
              icon: "database",
              label: "Busiest volume",
              field: "disk",
              value: busiest ? `${busiest.usedPercent.toFixed(0)}%` : "No data",
              hint: { field: "diskHint" },
            }),
            metric({
              icon: "activity",
              label: "DSUI memory",
              field: "processMemory",
              value: formatBytes(runtime.processMemoryBytes),
              hint: "Resident process memory",
            }),
          ],
        }),
        resourceHistory(cpu),
        storageSection(disks),
        KeyValue({ title: "Runtime", field: "runtime" }),
      ],
    }),
  ];
}

function storageSection(disks: readonly DiskSample[]) {
  return Section({
    title: "Storage",
    description:
      "Usage at configured paths. Multiple paths may share a filesystem.",
    content: Columns({
      columns: [
        {
          weight: 1,
          content: Card({
            title: "Disk usage history",
            description: "Mean usage across readable configured paths.",
            content: Chart({
              source: seriesSource("host-disk-series"),
              windows,
              label: "Mean disk usage over time",
              yRange: { min: 0, max: 100, unit: "%" },
            }),
          }),
        },
        {
          weight: 1,
          content: disks.length
            ? Grid({
                content: Collection({
                  field: "volumes",
                  content: Card({
                    title: { field: "title" },
                    description: { field: "description" },
                    variant: "panel",
                    content: Meter({ field: "meter" }),
                  }),
                }),
              })
            : statusNote({
                text: "No configured paths could be sampled. Check the monitoring paths and filesystem permissions.",
              }),
        },
      ],
    }),
  });
}

function seriesSource(resourceId: string) {
  return {
    kind: "resource-binding" as const,
    resourceId,
    input: { window: "1h" },
    refresh: { kind: "poll" as const, intervalMs: 2_000 },
  };
}

export type { MonitoringConfig, PluginContext };

function resourceHistory(cpu: CpuSample) {
  return Section({
    title: "Resource history",
    description: "Collected in the background, even when this page is closed.",
    content: Columns({
      columns: [
        {
          weight: 1,
          content: Card({
            title: "CPU load",
            description: "Runnable and waiting tasks, not CPU utilization.",
            content: Chart({
              source: seriesSource("host-cpu-series"),
              windows,
              label: "CPU load average",
              yRange: {
                min: 0,
                max: Math.max(cpu.cores, Math.ceil(cpu.loadAverage[0]), 1),
              },
              referenceLine: {
                value: cpu.cores,
                label: `${cpu.cores} logical cores`,
              },
            }),
          }),
        },
        {
          weight: 1,
          content: Card({
            title: "Memory usage",
            description: "Used system memory as a share of total capacity.",
            content: Chart({
              source: seriesSource("host-memory-series"),
              windows,
              label: "Memory used over time",
              yRange: { min: 0, max: 100, unit: "%" },
            }),
          }),
        },
      ],
    }),
  });
}
