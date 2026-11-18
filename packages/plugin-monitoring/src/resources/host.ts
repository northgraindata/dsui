/**
 * Host resources, declared so the overview page keeps itself current.
 *
 * Each reading is its own resource with its own interval, so a panel refreshes
 * on the cadence that suits it rather than on whatever the slowest sibling
 * dictates. The host owns the polling; nothing here schedules a timer.
 */

import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import { defineResource, poll, z } from "@northgraindata/dsui-plugin-sdk";
import type { CpuSample, DiskSample, MemorySample } from "../context.js";
import {
  formatBytes,
  sampleCpu,
  sampleDisk,
  sampleMemory,
  sampleProcessMemory,
  sampleUptime,
  sampleVolumes,
} from "../context.js";

export type { CpuSample, DiskSample, MemorySample };

/**
 * Load average and core count.
 *
 * Fast and cheap, so it polls more often than disk, whose `statfs` calls touch
 * the filesystem.
 */
export const hostCpu = defineResource({
  id: "host-cpu",
  query: () => sampleCpu(),
  refresh: poll("2s"),
});

/** Total, used, and free memory. */
export const hostMemory = defineResource({
  id: "host-memory",
  query: () => sampleMemory(),
  refresh: poll("2s"),
});

/**
 * Free space on the paths the plugin was configured with.
 *
 * Takes input because the set of paths is configuration, not a constant: a
 * deployment may care about `/data` only.
 */
export const hostDisk = defineResource({
  id: "host-disk",
  input: z.object({
    paths: z
      .array(z.object({ path: z.string().min(1), mount: z.string().min(1) }))
      .min(1),
  }),
  query: async ({ paths }) => {
    const samples = await Promise.all(
      paths.map(async ({ path, mount }) => ({
        mount,
        sample: await sampleDisk(path, mount),
      })),
    );
    return samples.flatMap(({ sample }): DiskSample[] =>
      sample ? [sample] : [],
    );
  },
  refresh: poll("10s"),
});

export const hostRuntime = defineResource({
  id: "host-runtime",
  query: () => ({
    processMemoryBytes: sampleProcessMemory(),
    processUptimeSeconds: process.uptime(),
    hostUptimeSeconds: sampleUptime(),
  }),
  refresh: poll("5s"),
});

/** Shared live readings for the overview cards, refreshed as one snapshot. */
export const hostOverview = defineResource({
  id: "host-overview",
  query: async (
    _input: unknown,
    {
      config,
    }: PluginContext<{
      paths: { path: string; mount: string }[];
      maxVolumes: number;
    }>,
  ) => {
    const cpu = sampleCpu();
    const memory = sampleMemory();
    const disks = await sampleVolumes(config.paths.slice(0, config.maxVolumes));
    const busiest = [...disks].sort((a, b) => b.usedPercent - a.usedPercent)[0];
    return {
      cpu: cpu.loadAverage[0].toFixed(2),
      memory: `${memory.usedPercent.toFixed(0)}%`,
      memoryHint: `${formatBytes(memory.usedBytes)} of ${formatBytes(memory.totalBytes)}`,
      disk: busiest ? `${busiest.usedPercent.toFixed(0)}%` : "No data",
      diskHint: busiest
        ? `${busiest.mount} · ${formatBytes(busiest.freeBytes)} available`
        : "No configured paths were sampled",
      processMemory: formatBytes(sampleProcessMemory()),
      runtime: {
        "DSUI process uptime": formatDuration(process.uptime()),
        "Host uptime": formatDuration(sampleUptime()),
        "Logical cores": cpu.cores,
        "Load averages · 1 / 5 / 15 min": cpu.loadAverage
          .map((value) => value.toFixed(2))
          .join(" / "),
        "Memory available": formatBytes(memory.totalBytes - memory.usedBytes),
      },
      volumes: disks.map((disk) => ({
        id: disk.mount,
        title: disk.mount,
        description: `${disk.usedPercent.toFixed(0)}% used · ${formatBytes(disk.freeBytes)} available`,
        meter: {
          format: "bytes",
          segments: [
            {
              label: "Used",
              value: disk.totalBytes - disk.freeBytes,
              tone: diskTone(disk.usedPercent),
            },
            { label: "Available", value: disk.freeBytes, tone: "muted" },
          ],
          footer: `${formatBytes(disk.totalBytes)} total capacity`,
        },
      })),
    };
  },
  refresh: poll("5s"),
});

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "less than a minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes / 60) % 24;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function diskTone(percent: number): "unavailable" | "warning" | "info" {
  if (percent >= 90) return "unavailable";
  if (percent >= 80) return "warning";
  return "info";
}
