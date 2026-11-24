import {
  defineResource,
  type PluginContext,
  poll,
} from "@northgraindata/dsui-plugin-sdk";
import { recentOperations, recentRuntime } from "../stores/history.js";

export const incidentHistory = defineResource({
  id: "incident-history",
  refresh: poll("10s"),
  query: async (_input, context: PluginContext) => {
    await context.access.requireAdmin?.();
    const snapshot = await context.diagnostics?.read();
    return {
      summary: {
        Collection: "Continuous · every 10 seconds · retained for 7 days",
        "CPU / RAM attribution":
          "Shared-process adapters: operation times only. Isolated Linux processes: measured CPU and RSS.",
        "Recent operations overwritten": snapshot?.droppedOperations ?? 0,
        "Log files":
          "diagnostic-*.log · 10 MB per file · 100 MB total · 7 days",
      },
      processes: (snapshot?.processes ?? []).map((entry) => ({
        id: String(entry.pid),
        title: `${entry.adapterId} · PID ${entry.pid}`,
        details: {
          Service: entry.serviceId ?? "Unassigned",
          "CPU (%)":
            entry.cpuPercent === null
              ? "Not available yet"
              : entry.cpuPercent.toFixed(1),
          "RAM (MB)":
            entry.rssBytes === null
              ? "Unavailable"
              : (entry.rssBytes / 1048576).toFixed(1),
        },
      })),
      items: [
        ...recentRuntime(context.storage).map((sample) => ({
          id: `runtime-${sample.time}`,
          title: `Resources · ${new Date(sample.time).toISOString()}`,
          details: {
            Started: new Date(sample.time).toISOString(),
            "Host CPU (%)": sample.metrics.hostCpuPercent ?? "First sample",
            "DSUI CPU (%)": sample.metrics.processCpuPercent ?? "First sample",
            "DSUI RSS (bytes)": sample.metrics.processRssBytes,
            "Host memory (%)": sample.metrics.memoryUsedPercent,
            "Event loop maximum (ms)":
              sample.metrics.eventLoopMaxMs ?? "First sample",
            "Swap used (bytes)": sample.metrics.swapUsedBytes ?? "Unavailable",
            "Process boot": sample.metrics.bootId,
          },
        })),
        ...recentOperations(context.storage).map((operation) => ({
          id: operation.id,
          title: `${operation.adapterId} · ${operation.serviceId ?? "unassigned"} · ${operation.kind}`,
          details: {
            Started: new Date(operation.startedAt).toISOString(),
            "Duration (ms)": Math.round(operation.durationMs),
            Outcome:
              operation.outcome === "active" &&
              !snapshot?.operations.some(
                (entry) =>
                  entry.id === operation.id && entry.outcome === "active",
              )
                ? "Interrupted or no longer observed"
                : operation.outcome,
          },
        })),
      ].sort((a, b) =>
        String(b.details.Started).localeCompare(String(a.details.Started)),
      ),
    };
  },
});
