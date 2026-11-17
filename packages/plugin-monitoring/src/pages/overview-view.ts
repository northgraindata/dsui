import {
  Card,
  Chart,
  type ChartWindow,
  Collection,
  Columns,
  Grid,
  KeyValue,
  Meter,
  Resource,
  Section,
} from "@northgraindata/dsui-plugin-sdk";
import { metric } from "../components/metric.js";
import { statusNote } from "../components/status.js";
import type { CpuSample, DiskSample } from "../context.js";

export function monitoringOverview({
  cpu,
  memoryPercent,
  processMemory,
  disks,
  windows,
}: {
  cpu: CpuSample;
  memoryPercent: number;
  processMemory: string;
  disks: readonly DiskSample[];
  windows: ChartWindow[];
}) {
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
              value: `${memoryPercent.toFixed(0)}%`,
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
              value: processMemory,
              hint: "Resident process memory",
            }),
          ],
        }),
        resourceHistory(cpu, windows),
        storageSection(disks, windows),
        KeyValue({ title: "Runtime", field: "runtime" }),
      ],
    }),
  ];
}

function storageSection(disks: readonly DiskSample[], windows: ChartWindow[]) {
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

function resourceHistory(cpu: CpuSample, windows: ChartWindow[]) {
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
