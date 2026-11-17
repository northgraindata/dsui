import {
  type ChartWindow,
  definePage,
  type PluginContext,
  type PluginResourceReader,
} from "@northgraindata/dsui-plugin-sdk";
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
import { monitoringOverview } from "./overview-view.js";

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
  return monitoringOverview({
    cpu,
    memoryPercent: memory.usedPercent,
    processMemory: formatBytes(runtime.processMemoryBytes),
    disks,
    windows,
  });
}

export type { MonitoringConfig, PluginContext };
