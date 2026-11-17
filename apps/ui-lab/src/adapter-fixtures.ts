import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { RendererClient } from "@northgraindata/dsui-renderer";
import { dbtModels, dbtModelDetail } from "./dbt-fixtures";
import type { Scenario } from "./fixtures";

const at = "2026-11-14T10:42:00Z";
const sql =
  "select order_id, customer_id, amount\nfrom {{ ref('stg_orders') }}\nwhere amount > 0";
const base = (index: number) => ({
  id: String(index + 1),
  name: ["orders", "customers", "daily_revenue"][index % 3],
  description: "Validated analytics model for the daily reporting pipeline.",
  status: index === 1 ? "warning" : "success",
  state: index === 1 ? "running" : "success",
  database: "analytics",
  schema: "public",
  type: "table",
  relationType: "table",
  size: "24 MB",
  sizeBytes: 25165824,
  rows: 1842050,
  rowCount: 1842050,
  owner: "analytics",
  createdAt: at,
  updatedAt: at,
  startedAt: at,
  duration: "24s",
  durationMs: 24000,
  durationSeconds: 24,
  runningFor: 24,
  progressPercent: 72,
  etaSeconds: 9,
  materialized: index === 1 ? "view" : "table",
  package: "analytics",
  uniqueId: `model.analytics.${["orders", "customers", "daily_revenue"][index % 3]}`,
  location: "models/marts",
  upstreamLabel: "2 upstream models",
  dependsOn: index ? ["model.analytics.orders"] : [],
  dag_id: "orders_daily",
  dagId: "orders_daily",
  dag_run_id: "scheduled__2026-11-14",
  dagRunId: "scheduled__2026-11-14",
  task_id: ["extract_orders", "load_orders", "validate_orders"][index % 3],
  taskId: ["extract_orders", "load_orders", "validate_orders"][index % 3],
  is_paused: false,
  is_active: true,
  schedule_interval: "0 6 * * *",
  schedule: "Daily at 06:00",
  tags: ["production", "analytics"],
  job_id: 42,
  job: "Daily analytics",
  cause: "Scheduled production build",
  started_at: at,
  start_date: at,
  end_date: at,
  content: sql,
  sql,
  compiledSql: sql.replace("{{ ref('stg_orders') }}", "analytics.stg_orders"),
  rawSql: sql,
  nullable: false,
  dataType: index ? "VARCHAR" : "BIGINT",
  data_type: index ? "VARCHAR" : "BIGINT",
  column_name: ["order_id", "customer_id", "amount"][index % 3],
});

/** Fixture fields come from the real serialized consumers, never from a backend call.
 * Overrides below supply richer contracts for graphs, meters and structured resources. */
export function adapterFixtureResources(nodes: readonly PageNode[]) {
  const resources = new Map<
    string,
    { fields: Set<string>; shape: "rows" | "object" | "collection" }
  >();
  const fields = (value: unknown, into: Set<string>) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) fields(item, into);
      return;
    }
    for (const [key, next] of Object.entries(value)) {
      if (
        [
          "field",
          "title",
          "description",
          "badge",
          "labelField",
          "idField",
          "detailField",
          "stateField",
          "dependsOnField",
        ].includes(key) &&
        typeof next === "string" &&
        /^[a-z_][a-zA-Z0-9_.]*$/.test(next)
      )
        into.add(next);
      if (key === "columns" && Array.isArray(next))
        for (const column of next)
          if (
            column &&
            typeof column === "object" &&
            typeof column.id === "string"
          )
            into.add(column.id);
      if (key === "meta" && Array.isArray(next))
        for (const item of next) if (typeof item === "string") into.add(item);
      fields(next, into);
    }
  };
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const record = value as Record<string, unknown>;
    if (
      record.kind === "collection" &&
      record.props &&
      typeof record.props === "object" &&
      "source" in record.props
    ) {
      const source = record.props.source;
      if (
        source &&
        typeof source === "object" &&
        "resourceId" in source &&
        typeof source.resourceId === "string"
      )
        resources.set(source.resourceId, {
          fields: new Set<string>(),
          shape: "collection",
        });
    }
    const source = record.source;
    if (
      source &&
      typeof source === "object" &&
      "resourceId" in source &&
      typeof source.resourceId === "string"
    ) {
      const existing = resources.get(source.resourceId) ?? {
        fields: new Set<string>(),
        shape: "rows" as const,
      };
      fields(value, existing.fields);
      if (
        existing.shape !== "collection" &&
        (record.field ||
          record.format ||
          record.content ||
          record.segments ||
          record.title === "Run" ||
          record.entries)
      )
        existing.shape = "object";
      resources.set(source.resourceId, existing);
    }
    for (const next of Object.values(record)) walk(next);
  };
  walk(nodes);
  return resources;
}
const sampleValue = (field: string, index: number): unknown => {
  if (field === "tone") return "healthy";
  if (/dependsOn|upstream.*Ids|downstream.*Ids/i.test(field)) return [];
  if (/^(id|graphId)$/.test(field)) return `${field}-${index}`;
  if (/percent|progress/i.test(field)) return 72;
  if (
    /count|bytes|rows|total|size|duration|seconds|memory|cpu|connections|models|tests|sources|projects|jobs|Runs$|tasks|schemas|tables|views|indexes/i.test(
      field,
    )
  )
    return 24 + index;
  if (/^(is_|has_|enabled|loaded|installed|nullable)/.test(field)) return true;
  if (/date|time|At$|_at$|started|finished/.test(field)) return at;
  if (/sql|query|source|content|Code$/.test(field)) return sql;
  if (/status|state/.test(field)) return "success";
  return field === "name"
    ? ["orders", "customers", "daily_revenue"][index % 3]
    : field.replaceAll("_", " ");
};
export function adapterClient(
  nodes: readonly PageNode[],
  scenario: Scenario,
  record: (event: string) => void,
): RendererClient {
  const definitions = adapterFixtureResources(nodes);
  const resolveHref = (path: string) => {
    const modelId = path.startsWith("/models/")
      ? decodeURIComponent(path.slice(8))
      : undefined;
    return modelId
      ? `/?${new URLSearchParams({ preview: "adapters/dbt/modelDetailPage", state: scenario, modelId })}`
      : path;
  };
  return {
    connection: { name: "UI Lab · local fixtures", endpoint: "local://ui-lab" },
    async executeResource(ref) {
      if (scenario === "loading") return new Promise<never>(() => undefined);
      if (scenario === "error")
        throw new Error("Fixture: connection timed out. Retry the request.");
      if (ref.resourceId === "models") return dbtModels(scenario);
      if (ref.resourceId === "model-detail")
        return dbtModelDetail(
          scenario,
          typeof window === "undefined"
            ? undefined
            : (new URLSearchParams(window.location.search).get("modelId") ??
                undefined),
        );
      if (ref.resourceId === "model-lineage")
        return dbtModels(scenario).map((row) => ({
          ...row,
          graphId: row.uniqueId,
          upstreamGraphIds: row.dependsOn,
          detail: row.schema,
          state: row.name === "fct_orders" ? "current" : "upstream",
        }));
      const contract = definitions.get(ref.resourceId);
      // Custom workspaces own their resources rather than declaring source bindings.
      if (ref.resourceId === "s3-buckets")
        return scenario === "empty"
          ? []
          : [
              {
                name: "analytics-exports",
                createdAt: at,
                region: "eu-central-1",
              },
            ];
      if (ref.resourceId === "s3-objects")
        return {
          rows:
            scenario === "empty"
              ? []
              : [
                  {
                    key: "orders.csv",
                    name: "orders.csv",
                    type: "object",
                    bucket: "analytics-exports",
                    eTag: "local",
                    storageClass: "STANDARD",
                    size: 25165824,
                    lastModified: at,
                    contentType: "text/csv",
                  },
                  {
                    key: "archive/",
                    name: "archive",
                    type: "folder",
                    bucket: "analytics-exports",
                    eTag: "",
                    storageClass: "STANDARD",
                    contentType: "",
                    size: 0,
                    lastModified: at,
                  },
                ],
          nextToken: undefined,
        };
      if (!contract)
        throw new Error(`Missing adapter fixture: ${ref.resourceId}`);
      const count = scenario === "empty" ? 0 : scenario === "stress" ? 90 : 3;
      if (ref.resourceId === "recent-runs") {
        if (!count) return [];
        const states = ["success", "warning", "failed", "success"];
        const rowsToShow = scenario === "stress" ? count : states.length;
        return Array.from({ length: rowsToShow }, (_, index) => {
          const status = states[index % states.length]!;
          const started = new Date(Date.now() - index * 86_400_000);
          return {
            id: `run-${index + 1}`,
            job: "Daily analytics",
            status:
              status === "success"
                ? "Success"
                : status === "failed"
                  ? "Failed"
                  : "Warning",
            tone:
              status === "success"
                ? "healthy"
                : status === "failed"
                  ? "unavailable"
                  : "warning",
            cause:
              index % 2 ? "Scheduled production build" : "Triggered from DSUI",
            started: new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
              timeZone: "UTC",
            }).format(started),
          };
        });
      }
      const rows = Array.from({ length: count }, (_, index) => {
        const row: Record<string, unknown> = { ...base(index) };
        for (const field of contract.fields)
          if (!(field in row)) row[field] = sampleValue(field, index);
        return row;
      });
      if (contract.shape === "collection")
        return ref.resourceId === "dag-overview" ? rows.slice(0, 1) : rows;
      if (/logs?$|source$|ddl$|artifact-detail/.test(ref.resourceId))
        return {
          content: /log/.test(ref.resourceId)
            ? "10:42:00 Starting orders build\n10:42:24 Completed 24 models, 86 tests.\n10:42:25 Build finished successfully."
            : sql,
          language: "sql",
          name: "manifest.json",
          size: 4200,
        };
      if (/meter|usage/.test(ref.resourceId))
        return {
          segments: [
            { label: "Used", value: 72, tone: "warning" },
            { label: "Available", value: 28, tone: "healthy" },
          ],
          total: 100,
        };
      if (/graph|lineage/.test(ref.resourceId))
        return rows.map((row, index) => ({
          ...row,
          id: `task-${index}`,
          graphId: `task-${index}`,
          taskId: `task-${index}`,
          dependsOn: index ? ["task-0"] : [],
          upstreamGraphIds: index ? ["task-0"] : [],
        }));
      if (
        /overview$|dashboard|details?$|server-info|capabilities|database-size|extension-profile/.test(
          ref.resourceId,
        ) ||
        contract.shape === "object"
      ) {
        const sample = rows[0] ?? {};
        const detail: Record<string, unknown> = {};
        for (const field of contract.fields)
          detail[field] = sample[field] ?? sampleValue(field, 0);
        if (/overview$|dashboard/.test(ref.resourceId))
          return {
            ...detail,
            method: "cloud",
            models: count ? 24 : 0,
            tests: count ? 86 : 0,
            sources: count ? 8 : 0,
            projects: 2,
            jobs: 4,
            latestStatus: count ? "success" : "No runs",
            latestTone: count ? "healthy" : "muted",
            latestDuration: count ? "24s" : "",
            latestSummary: count
              ? "88 nodes · 2 warnings"
              : "No run results yet",
            history: Array.from({ length: 7 }, (_, index) => {
              const day = new Date(Date.now() - (6 - index) * 86_400_000);
              const total = count ? [3, 2, 4, 5, 2, 4, 6][index]! : 0;
              return {
                date: day.toISOString().slice(0, 10),
                label: new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                }).format(day),
                success: Math.max(
                  0,
                  total - (index === 3 ? 1 : 0) - (index === 5 ? 1 : 0),
                ),
                warning: index === 3 && total ? 1 : 0,
                error: index === 5 && total ? 1 : 0,
              };
            }),
            segments: [
              { label: "Passed", value: 86, tone: "healthy" },
              { label: "Warning", value: 2, tone: "warning" },
            ],
          };
        if (/model-detail/.test(ref.resourceId))
          return {
            name: "orders",
            uniqueId: "model.analytics.orders",
            materialized: "table",
            database: "analytics",
            schema: "public",
            description:
              "Daily order facts with validated customer references.",
            rawCode: sql,
            compiledCode: sql.replace(
              "{{ ref('stg_orders') }}",
              "analytics.stg_orders",
            ),
          };
        return {
          name: "Orders",
          status: "success",
          database: "analytics",
          owner: "analytics",
          ...detail,
        };
      }
      return rows;
    },
    async executeAction(ref) {
      record(`Local action: ${ref.actionId}`);
      if (scenario === "error")
        return { status: "error", message: "Fixture: action failed" };
      return {
        status: "success",
        data: {
          columns: ["order_id", "amount"],
          rows: [{ order_id: 1042, amount: 89.5 }],
          elapsedMs: 24,
        },
      };
    },
    resolveHref,
    navigate(path) {
      record(`Navigate: ${path}`);
      if (typeof window !== "undefined" && path.startsWith("/models/"))
        window.location.assign(resolveHref(path));
    },
    openOverlay(id) {
      record(`Open: ${id}`);
    },
    closeOverlay() {
      record("Closed overlay");
    },
  };
}
