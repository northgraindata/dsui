import type { DataSource } from "@northgraindata/dsui-adapter-sdk";
import type { RendererClient } from "@northgraindata/dsui-renderer";

export const scenarios = [
  "normal",
  "empty",
  "loading",
  "error",
  "stress",
] as const;
export type Scenario = (typeof scenarios)[number];
export const epoch = Math.floor(Date.now() / 60_000) * 60_000;
export const rows = [
  { name: "analytics.orders", type: "table", rows: 1842050, status: "healthy" },
  {
    name: "analytics.customers",
    type: "table",
    rows: 42810,
    status: "warning",
  },
  {
    name: "analytics.daily_revenue",
    type: "view",
    rows: null,
    status: "healthy",
  },
];
export const columns = [
  { id: "name", label: "Name" },
  { id: "type", label: "Type" },
  { id: "rows", label: "Rows" },
  { id: "status", label: "Status" },
];
export const points = Array.from({ length: 60 }, (_, i) => ({
  time: epoch - (59 - i) * 60000,
  value: 42 + Math.sin(i / 6) * 12 + Math.cos(i / 3) * 3,
}));
export function source(resourceId: string): DataSource {
  return {
    kind: "resource-binding",
    resourceId,
    input: {},
    refresh: { kind: "manual" },
  };
}
export function dataRows(scenario: Scenario) {
  if (scenario === "empty") return [];
  if (scenario !== "stress") return rows;
  return Array.from({ length: 120 }, (_, i) => ({
    name: `warehouse.production_customer_events_with_a_very_long_table_name_${i}`,
    type: i % 2 ? "view" : "table",
    rows: i % 3 ? i * 182045 : null,
    status: i % 4 ? "healthy" : "unavailable",
  }));
}
export function healthRows(scenario: Scenario) {
  return dataRows(scenario).map((row, i) => ({
    id: `service-${i}`,
    name: row.name,
    adapter: i % 2 ? "ClickHouse" : "PostgreSQL",
    health: row.status,
    latencyMs: 12 + i * 9,
    detail: i % 2 ? "Connection responding normally" : "Last check completed",
    history: Array.from({ length: 168 }, (_, hour) => ({
      time: epoch - (167 - hour) * 3600000,
      health: hour % 41 === 0 ? "warning" : "healthy",
      latencyMs: 12 + i * 9,
    })),
  }));
}
export function createClient(
  scenario: Scenario,
  record: (event: string) => void = () => undefined,
): RendererClient {
  const resources: Record<string, () => unknown> = {
    tables: () => dataRows(scenario),
    collection: () => dataRows(scenario),
    overview: () => ({
      reading: "42",
      name: "Production",
      runtime: { Version: "0.4.0", Host: "dsui-local", Region: "eu-central" },
    }),
    "host-overview": () => ({
      cpu: "2.34",
      memory: "58%",
      disk: scenario === "empty" ? "No data" : "72%",
      processMemory: "256 MB",
      memoryHint: "9.3 GB / 16 GB",
      diskHint: "/data",
      runtime: { Host: "dsui-local", Platform: "Linux", Uptime: "4 days" },
      volumes:
        scenario === "empty"
          ? []
          : [
              {
                title: "/data",
                description: "Primary volume",
                meter: {
                  segments: [
                    { label: "Used", value: 72 * 1024 ** 3, tone: "info" },
                    { label: "Free", value: 28 * 1024 ** 3, tone: "muted" },
                  ],
                },
              },
            ],
    }),
    "host-cpu-series": () =>
      scenario === "empty"
        ? []
        : points.map((p) => ({ ...p, value: p.value / 12 })),
    "host-memory-series": () => (scenario === "empty" ? [] : points),
    "host-disk-series": () => (scenario === "empty" ? [] : points),
    series: () => (scenario === "empty" ? [] : points),
    "service-health": () => ({ items: healthRows(scenario) }),
    file: () => ({
      content: "select * from analytics.orders limit 100;",
      language: "sql",
      size: 49,
    }),
  };
  return {
    connection: { name: "Local fixture", endpoint: "local://ui-lab" },
    async executeResource(reference) {
      const resource = resources[reference.resourceId];
      if (!resource)
        throw new Error(`Missing UI Lab fixture: ${reference.resourceId}`);
      if (scenario === "loading") return new Promise<never>(() => undefined);
      if (scenario === "error")
        throw new Error("Fixture: connection timed out. Retry the request.");
      return resource();
    },
    async executeAction(reference) {
      record(`Action: ${reference.actionId}`);
      if (scenario === "loading") return new Promise<never>(() => undefined);
      if (scenario === "error")
        return { status: "error", message: "Fixture: action failed." };
      if (reference.actionId !== "query" && reference.actionId !== "save")
        throw new Error(`Missing UI Lab action: ${reference.actionId}`);
      return {
        status: "success",
        data: {
          columns: columns.map((c) => c.id),
          rows: dataRows(scenario),
          elapsedMs: 24,
        },
      };
    },
    navigate(path) {
      record(`Navigate: ${path}`);
    },
    openOverlay(id) {
      record(`Open overlay: ${id}`);
    },
    closeOverlay() {
      record("Close overlay");
    },
  };
}
