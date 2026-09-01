import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  baseUrl: z.string().url(),
  apiVersion: z.enum(["auto", "v1", "v2"]).default("auto"),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});
const pageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
type Json = Record<string, unknown>;
type ApiVersion = "v1" | "v2";

const listCapabilities = [
  ["dags", "DAGs", "job-browser"],
  ["dag-runs", "DAG runs", "job-browser"],
  ["task-instances", "Task instances", "job-browser"],
  ["assets", "Assets and datasets", "record-list"],
  ["asset-aliases", "Asset aliases", "record-list"],
  ["asset-events", "Asset events", "record-list"],
  ["backfills", "Backfills", "job-browser"],
  ["dag-versions", "DAG versions", "record-list"],
  ["pools", "Pools", "record-list"],
  ["variables", "Variables", "record-list"],
  ["connections", "Connections", "record-list"],
  ["providers", "Providers", "record-list"],
  ["plugins", "Plugins", "record-list"],
  ["import-errors", "Import errors", "record-list"],
  ["event-logs", "Audit log", "record-list"],
  ["jobs", "Jobs", "job-browser"],
  ["dag-warnings", "DAG warnings", "record-list"],
  ["tags", "DAG tags", "record-list"],
  ["users", "Users", "record-list"],
  ["roles", "Roles", "record-list"],
  ["permissions", "Permissions", "record-list"],
] as const;

const actionCapabilities = [
  ["trigger-dag", "Trigger DAG"],
  ["set-dag-paused", "Pause or unpause DAG"],
  ["clear-task-instances", "Clear task instances"],
  ["set-task-instance-state", "Set task state"],
  ["update-variable", "Create or update variable"],
  ["update-connection", "Create or update connection"],
  ["update-pool", "Create or update pool"],
  ["materialize-asset", "Materialize asset"],
  ["backfill-action", "Manage backfill"],
  ["delete-resource", "Delete Airflow resource"],
  ["api-request", "Airflow API request"],
] as const;

export const airflowAdapter = defineAdapter({
  id: "airflow",
  version: "0.2.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "airflow",
    name: "Apache Airflow",
    category: "Orchestration",
    description:
      "Operate Apache Airflow across the stable REST API in Airflow 2 and 3.",
    icon: "airflow",
    docsUrl:
      "https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "baseUrl",
      label: "Airflow URL",
      type: "url",
      required: true,
      placeholder: "http://airflow:8080",
    },
    {
      id: "apiVersion",
      label: "REST API version",
      type: "select",
      required: true,
      options: [
        { label: "Detect automatically", value: "auto" },
        { label: "Airflow 2 API (v1)", value: "v1" },
        { label: "Airflow 3 API (v2)", value: "v2" },
      ],
    },
    { id: "token", label: "Bearer token", type: "password", secret: true },
    { id: "username", label: "Username", type: "text" },
    { id: "password", label: "Password", type: "password", secret: true },
  ],
  secretPaths: ["token", "password"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Environment" },
    },
    {
      id: "health",
      authorization: "inspect",
      view: { kind: "service-info", title: "Health" },
    },
    ...listCapabilities.map(([id, title, kind]) => ({
      id,
      authorization: "inspect" as const,
      supportsPagination: true,
      maxPageSize: 100,
      view: { kind, title },
    })),
    {
      id: "config",
      authorization: "inspect",
      view: { kind: "record-list", title: "Configuration" },
    },
    {
      id: "tasks",
      authorization: "inspect",
      view: { kind: "record-list", title: "DAG tasks" },
    },
    {
      id: "dag-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "DAG details" },
    },
    {
      id: "dag-source",
      authorization: "inspect",
      view: { kind: "record-detail", title: "DAG code" },
    },
    {
      id: "task-log",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Task logs" },
    },
    {
      id: "xcom-entries",
      authorization: "inspect",
      view: { kind: "record-list", title: "XCom" },
    },
    ...actionCapabilities.map(([id, title]) => ({
      id,
      authorization: "execute" as const,
      view: { kind: "action-form" as const, title },
    })),
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const origin = connection.baseUrl.replace(/\/$/, "");
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (connection.token) headers.Authorization = `Bearer ${connection.token}`;
    else if (connection.username && connection.password)
      headers.Authorization = `Basic ${Buffer.from(`${connection.username}:${connection.password}`).toString("base64")}`;

    async function request<T>(url: string, init?: RequestInit): Promise<T> {
      const response = await fetchFn(url, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
        signal: context.signal,
      });
      if (response.status === 204) return {} as T;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        const text = await response.text();
        if (!response.ok)
          throw new Error(text || `Airflow responded ${response.status}`);
        return { content: text } as T;
      }
      const body = (await response.json().catch(() => ({}))) as T & {
        detail?: string | { reason?: string };
        title?: string;
      };
      if (!response.ok) {
        const detail =
          typeof body.detail === "string"
            ? body.detail
            : (body.detail?.reason ?? body.title);
        throw new Error(detail ?? `Airflow responded ${response.status}`);
      }
      return body;
    }

    let detectedVersion: Promise<ApiVersion> | undefined;
    async function resolveVersion(): Promise<ApiVersion> {
      if (connection.apiVersion !== "auto") return connection.apiVersion;
      detectedVersion ??= (async () => {
        const v2 = await fetchFn(`${origin}/api/v2/version`, {
          headers,
          signal: context.signal,
        });
        if (v2.status !== 404) return "v2";
        const v1 = await fetchFn(`${origin}/api/v1/version`, {
          headers,
          signal: context.signal,
        });
        if (v1.status !== 404) return "v1";
        throw new Error("No supported Apache Airflow REST API was found");
      })();
      return detectedVersion;
    }
    async function api<T>(path: string, init?: RequestInit): Promise<T> {
      const version = await resolveVersion();
      return request<T>(`${origin}/api/${version}${path}`, init);
    }
    async function versionedPath(v1: string | null, v2: string | null) {
      const version = await resolveVersion();
      const path = version === "v1" ? v1 : v2;
      if (!path)
        throw new Error(
          `This operation is not available in the Apache Airflow ${version} public API`,
        );
      return path;
    }
    async function healthPath() {
      return (await resolveVersion()) === "v2" ? "/monitor/health" : "/health";
    }
    async function page(
      path: string | Promise<string>,
      key: string,
      input: unknown,
    ) {
      const { limit, offset } = pageInput.parse(input);
      const resolved = await path;
      return api<Json>(
        `${resolved}${resolved.includes("?") ? "&" : "?"}limit=${limit}&offset=${offset}`,
      ).then((body) => ({
        items: (body[key] as unknown[]) ?? [],
        nextCursor:
          typeof body.total_entries === "number" &&
          offset + limit < body.total_entries
            ? String(offset + limit)
            : undefined,
      }));
    }
    const ids = z.object({
      dagId: z.string().min(1),
      dagRunId: z.string().min(1),
    });

    return {
      async health() {
        const started = Date.now();
        try {
          const health = await api<Json>(await healthPath());
          const states = [
            health.metadatabase,
            health.scheduler,
            health.triggerer,
          ].filter(Boolean) as Json[];
          const healthy = states.every(
            (item) => item.status === "healthy" || item.status == null,
          );
          return {
            status: healthy ? "healthy" : "warning",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: healthy
              ? undefined
              : "One or more Apache Airflow components are unhealthy",
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to reach the Apache Airflow API",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "api-request") {
          const parsed = z
            .object({
              method: z
                .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
                .default("GET"),
              path: z.string().min(1),
              body: z.unknown().optional(),
            })
            .parse(input);
          const path = parsed.path.startsWith("/")
            ? parsed.path
            : `/${parsed.path}`;
          if (path.includes("..") || !/^\/[A-Za-z0-9_~%?=&.,:/+-]*$/.test(path))
            throw new Error(
              "API path must be a safe path relative to /api/v1 or /api/v2",
            );
          return api(path, {
            method: parsed.method,
            body:
              parsed.body === undefined
                ? undefined
                : JSON.stringify(parsed.body),
          });
        }
        if (operationId === "health")
          return api<Json>(await healthPath()).then((value) => ({
            items: Object.entries(value).map(([label, item]) => ({
              label,
              value:
                typeof item === "object" ? JSON.stringify(item) : String(item),
            })),
          }));
        if (operationId === "service-info") {
          const [version, health, restVersion] = await Promise.all([
            api<Json>("/version"),
            api<Json>(await healthPath()),
            resolveVersion(),
          ]);
          return {
            items: [
              {
                label: "Airflow version",
                value: String(version.version ?? ""),
              },
              { label: "REST API", value: restVersion },
              {
                label: "Git version",
                value: String(version.git_version ?? ""),
              },
              ...["metadatabase", "scheduler", "triggerer"].map((label) => ({
                label,
                value: String(
                  (health[label] as Json | undefined)?.status ?? "unknown",
                ),
                format: "status",
              })),
            ],
          };
        }
        if (operationId === "dags")
          return page("/dags?only_active=false", "dags", input);
        if (operationId === "assets") {
          const version = await resolveVersion();
          return page(
            version === "v1" ? "/datasets" : "/assets",
            version === "v1" ? "datasets" : "assets",
            input,
          );
        }
        if (operationId === "asset-aliases")
          return page(
            versionedPath(null, "/assets/aliases"),
            "asset_aliases",
            input,
          );
        if (operationId === "asset-events") {
          const version = await resolveVersion();
          return page(
            version === "v1" ? "/datasets/events" : "/assets/events",
            version === "v1" ? "dataset_events" : "asset_events",
            input,
          );
        }
        const commonLists: Record<
          string,
          [string | null, string | null, string]
        > = {
          pools: ["/pools", "/pools", "pools"],
          variables: ["/variables", "/variables", "variables"],
          connections: ["/connections", "/connections", "connections"],
          providers: ["/providers", "/providers", "providers"],
          plugins: ["/plugins", "/plugins", "plugins"],
          "import-errors": ["/importErrors", "/importErrors", "import_errors"],
          "event-logs": ["/eventLogs", "/eventLogs", "event_logs"],
          "dag-warnings": ["/dagWarnings", "/dagWarnings", "dag_warnings"],
          jobs: [null, "/jobs", "jobs"],
          tags: [null, "/dagTags", "tags"],
          users: ["/users", null, "users"],
          roles: ["/roles", null, "roles"],
          permissions: ["/permissions", null, "permissions"],
          backfills: [null, "/backfills", "backfills"],
          "dag-versions": [null, "/dagVersions", "dag_versions"],
        };
        const list = commonLists[operationId];
        if (list) return page(versionedPath(list[0], list[1]), list[2], input);
        if (operationId === "config")
          return api<Json>("/config").then((body) => ({
            items: body.sections ?? [],
          }));
        if (operationId === "dag-runs") {
          const parsed = pageInput
            .extend({ dagId: z.string().optional() })
            .parse(input);
          const version = await resolveVersion();
          if (version === "v2" && !parsed.dagId)
            throw new Error(
              "dagId is required by the Apache Airflow v2 DAG runs API",
            );
          const path =
            version === "v1"
              ? "/dags/~/dagRuns/list"
              : `/dags/${encodeURIComponent(parsed.dagId as string)}/dagRuns/list`;
          return api<Json>(path, {
            method: "POST",
            body: JSON.stringify({
              page_limit: parsed.limit,
              page_offset: parsed.offset,
              order_by: "-logical_date",
            }),
          }).then((body) => ({ items: body.dag_runs ?? [] }));
        }
        if (operationId === "task-instances") {
          const parsed = pageInput.merge(ids.partial()).parse(input);
          const version = await resolveVersion();
          if (version === "v2" && (!parsed.dagId || !parsed.dagRunId))
            throw new Error(
              "dagId and dagRunId are required by the Apache Airflow v2 task instances API",
            );
          const path =
            version === "v1"
              ? "/dags/~/dagRuns/~/taskInstances/list"
              : `/dags/${encodeURIComponent(parsed.dagId as string)}/dagRuns/${encodeURIComponent(parsed.dagRunId as string)}/taskInstances/list`;
          return api<Json>(path, {
            method: "POST",
            body: JSON.stringify({
              page_limit: parsed.limit,
              page_offset: parsed.offset,
              order_by: "-start_date",
            }),
          }).then((body) => ({ items: body.task_instances ?? [] }));
        }
        if (operationId === "tasks") {
          const { dagId } = ids.pick({ dagId: true }).parse(input);
          return api<Json>(`/dags/${encodeURIComponent(dagId)}/tasks`).then(
            (body) => ({ items: body.tasks ?? [] }),
          );
        }
        if (operationId === "dag-detail") {
          const { dagId } = ids.pick({ dagId: true }).parse(input);
          return api(`/dags/${encodeURIComponent(dagId)}/details`);
        }
        if (operationId === "dag-source") {
          const parsed = z
            .object({
              fileToken: z.string().optional(),
              dagId: z.string().optional(),
            })
            .parse(input);
          const version = await resolveVersion();
          const id = version === "v1" ? parsed.fileToken : parsed.dagId;
          if (!id)
            throw new Error(
              version === "v1" ? "fileToken is required" : "dagId is required",
            );
          return api(`/dagSources/${encodeURIComponent(id)}`);
        }
        if (operationId === "task-log") {
          const parsed = ids
            .extend({
              taskId: z.string(),
              tryNumber: z.coerce.number().int().positive().default(1),
              fullContent: z.boolean().default(true),
            })
            .parse(input);
          return api(
            `/dags/${encodeURIComponent(parsed.dagId)}/dagRuns/${encodeURIComponent(parsed.dagRunId)}/taskInstances/${encodeURIComponent(parsed.taskId)}/logs/${parsed.tryNumber}?full_content=${parsed.fullContent}`,
          );
        }
        if (operationId === "xcom-entries") {
          const parsed = ids
            .extend({
              taskId: z.string(),
              mapIndex: z.coerce.number().int().default(-1),
            })
            .parse(input);
          return page(
            `/dags/${encodeURIComponent(parsed.dagId)}/dagRuns/${encodeURIComponent(parsed.dagRunId)}/taskInstances/${encodeURIComponent(parsed.taskId)}/xcomEntries?map_index=${parsed.mapIndex}`,
            "xcom_entries",
            input,
          );
        }
        if (operationId === "trigger-dag") {
          const parsed = z
            .object({
              dagId: z.string(),
              logicalDate: z.string().optional(),
              conf: z.record(z.unknown()).default({}),
              note: z.string().optional(),
            })
            .parse(input);
          return api(`/dags/${encodeURIComponent(parsed.dagId)}/dagRuns`, {
            method: "POST",
            body: JSON.stringify({
              logical_date: parsed.logicalDate,
              conf: parsed.conf,
              note: parsed.note,
            }),
          });
        }
        if (operationId === "set-dag-paused") {
          const parsed = z
            .object({ dagId: z.string(), isPaused: z.boolean() })
            .parse(input);
          return api(`/dags/${encodeURIComponent(parsed.dagId)}`, {
            method: "PATCH",
            body: JSON.stringify({ is_paused: parsed.isPaused }),
          });
        }
        if (operationId === "clear-task-instances") {
          const parsed = z
            .object({
              dagId: z.string(),
              dryRun: z.boolean().default(false),
              startDate: z.string().optional(),
              endDate: z.string().optional(),
              onlyFailed: z.boolean().default(false),
              includeSubdags: z.boolean().default(true),
              includeParentdag: z.boolean().default(true),
              resetDagRuns: z.boolean().default(true),
            })
            .parse(input);
          return api(
            `/dags/${encodeURIComponent(parsed.dagId)}/clearTaskInstances`,
            {
              method: "POST",
              body: JSON.stringify({
                dry_run: parsed.dryRun,
                start_date: parsed.startDate,
                end_date: parsed.endDate,
                only_failed: parsed.onlyFailed,
                include_subdags: parsed.includeSubdags,
                include_parentdag: parsed.includeParentdag,
                reset_dag_runs: parsed.resetDagRuns,
              }),
            },
          );
        }
        if (operationId === "set-task-instance-state") {
          const parsed = ids
            .extend({
              taskId: z.string(),
              state: z.enum(["success", "failed", "skipped"]),
              mapIndex: z.coerce.number().int().default(-1),
            })
            .parse(input);
          if ((await resolveVersion()) === "v1")
            return api(
              `/dags/${encodeURIComponent(parsed.dagId)}/updateTaskInstancesState`,
              {
                method: "POST",
                body: JSON.stringify({
                  dag_run_id: parsed.dagRunId,
                  task_id: parsed.taskId,
                  new_state: parsed.state,
                  map_index: parsed.mapIndex,
                }),
              },
            );
          return api(
            `/dags/${encodeURIComponent(parsed.dagId)}/dagRuns/${encodeURIComponent(parsed.dagRunId)}/taskInstances/${encodeURIComponent(parsed.taskId)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                new_state: parsed.state,
                map_index: parsed.mapIndex,
              }),
            },
          );
        }
        if (operationId === "update-variable") {
          const parsed = z
            .object({
              key: z.string(),
              value: z.string(),
              description: z.string().optional(),
              create: z.boolean().default(false),
            })
            .parse(input);
          return api(
            `/variables${parsed.create ? "" : `/${encodeURIComponent(parsed.key)}`}`,
            {
              method: parsed.create ? "POST" : "PATCH",
              body: JSON.stringify({
                key: parsed.key,
                value: parsed.value,
                description: parsed.description,
              }),
            },
          );
        }
        if (operationId === "update-connection") {
          const parsed = z
            .object({
              connectionId: z.string(),
              create: z.boolean().default(false),
              connection: z.record(z.unknown()),
            })
            .parse(input);
          return api(
            `/connections${parsed.create ? "" : `/${encodeURIComponent(parsed.connectionId)}`}`,
            {
              method: parsed.create ? "POST" : "PATCH",
              body: JSON.stringify({
                connection_id: parsed.connectionId,
                ...parsed.connection,
              }),
            },
          );
        }
        if (operationId === "update-pool") {
          const parsed = z
            .object({
              name: z.string(),
              slots: z.coerce.number().int(),
              description: z.string().optional(),
              includeDeferred: z.boolean().default(false),
              create: z.boolean().default(false),
            })
            .parse(input);
          return api(
            `/pools${parsed.create ? "" : `/${encodeURIComponent(parsed.name)}`}`,
            {
              method: parsed.create ? "POST" : "PATCH",
              body: JSON.stringify({
                name: parsed.name,
                slots: parsed.slots,
                description: parsed.description,
                include_deferred: parsed.includeDeferred,
              }),
            },
          );
        }
        if (operationId === "materialize-asset") {
          const { id } = z.object({ id: z.string().min(1) }).parse(input);
          return api(
            await versionedPath(
              null,
              `/assets/${encodeURIComponent(id)}/materialize`,
            ),
            { method: "POST" },
          );
        }
        if (operationId === "backfill-action") {
          const parsed = z
            .object({
              backfillId: z.coerce.number().int(),
              action: z.enum(["pause", "unpause", "cancel"]),
            })
            .parse(input);
          return api(
            await versionedPath(
              null,
              `/backfills/${parsed.backfillId}/${parsed.action}`,
            ),
            { method: "PUT" },
          );
        }
        if (operationId === "delete-resource") {
          const parsed = z
            .object({
              resource: z.enum([
                "dag",
                "variable",
                "connection",
                "pool",
                "asset",
              ]),
              id: z.string(),
            })
            .parse(input);
          const roots = {
            dag: "dags",
            variable: "variables",
            connection: "connections",
            pool: "pools",
            asset: (await resolveVersion()) === "v1" ? "datasets" : "assets",
          } as const;
          return api(
            `/${roots[parsed.resource]}/${encodeURIComponent(parsed.id)}`,
            { method: "DELETE" },
          );
        }
        throw new Error(`Unsupported Apache Airflow operation: ${operationId}`);
      },
    };
  },
});

export default airflowAdapter;
