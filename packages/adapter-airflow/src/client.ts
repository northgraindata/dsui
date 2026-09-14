import { Buffer } from "node:buffer";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type {
  AirflowClient,
  AirflowConnection,
  AirflowHttpConfig,
  AirflowPool,
  AirflowUser,
  AirflowVariable,
  AirflowVersion,
  Asset,
  AssetEvent,
  DagDetails,
  DagRun,
  DagSummary,
  DagTask,
  TaskInstance,
  TaskInstanceRef,
  TaskLogEntry,
} from "./context.js";

const versionResponseSchema = z.object({
  version: z.string().min(1),
});
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const nullableString = z.string().nullable().optional();
const tagSchema = z.object({ name: z.string() });
const dagSchema = z.object({
  dag_id: z.string().min(1),
  dag_display_name: z.string().min(1).optional(),
  is_paused: z.boolean(),
  is_stale: z.boolean().optional().default(false),
  description: z.string().nullable().optional(),
  timetable_summary: z.string().nullable().optional(),
  last_parsed_time: z.string().nullable().optional(),
  owners: z.array(z.string()).optional(),
  tags: z.array(tagSchema).optional(),
  next_dagrun_create_after: nullableString,
});
const dagCollectionSchema = z.object({
  dags: z.array(dagSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const dagDetailsSchema = dagSchema.extend({
  fileloc: z.string().optional().default(""),
});
const airflow2DagSchema = z.object({
  dag_id: z.string().min(1),
  dag_display_name: z.string().min(1).optional(),
  is_paused: z.boolean(),
  is_active: z.boolean().nullable().optional(),
  description: z.string().nullable().optional(),
  timetable_description: z.string().nullable().optional(),
  last_parsed_time: z.string().nullable().optional(),
  owners: z.array(z.string()).optional(),
  tags: z.array(tagSchema).nullable().optional(),
  next_dagrun_create_after: nullableString,
});
const airflow2DagCollectionSchema = z.object({
  dags: z.array(airflow2DagSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const airflow2DagDetailsSchema = airflow2DagSchema.extend({
  fileloc: z.string().optional().default(""),
  file_token: z.string().min(1).optional(),
});
const dagSourceSchema = z.object({
  content: z.string(),
});
const taskSchema = z.object({
  task_id: z.string().min(1),
  task_display_name: z.string().min(1).optional(),
  owner: z.string().optional().default(""),
  operator_name: z.string().optional().default(""),
  is_mapped: z.boolean().optional().default(false),
  downstream_task_ids: z.array(z.string()).optional().default([]),
});
const taskCollectionSchema = z.object({
  tasks: z.array(taskSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const airflow2TaskSchema = z.object({
  task_id: z.string().min(1),
  task_display_name: z.string().min(1).optional(),
  owner: z.string().optional().default(""),
  class_ref: z.object({
    module_path: z.string().optional().default(""),
    class_name: z.string().min(1),
  }),
  is_mapped: z.boolean().optional().default(false),
  downstream_task_ids: z.array(z.string()).optional().default([]),
});
const airflow2TaskCollectionSchema = z.object({
  tasks: z.array(airflow2TaskSchema).max(100),
});
const dagRunSchema = z
  .object({
    dag_run_id: z.string().min(1).optional(),
    run_id: z.string().min(1).optional(),
    dag_id: z.string().min(1),
    state: z.string().nullable().optional(),
    run_type: z.string().nullable().optional(),
    logical_date: nullableString,
    run_after: nullableString,
    start_date: nullableString,
    end_date: nullableString,
    note: nullableString,
  })
  .transform((data) => ({
    ...data,
    dag_run_id: data.dag_run_id ?? data.run_id ?? "",
    state: data.state ?? "queued",
    run_type: data.run_type ?? "manual",
  }));
const dagRunCollectionSchema = z.object({
  dag_runs: z.array(dagRunSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const taskInstanceSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform(String)
    .optional()
    .default(""),
  task_id: z.string().min(1),
  dag_id: z.string().min(1),
  dag_run_id: z.string().min(1),
  map_index: z.number().int(),
  start_date: nullableString,
  end_date: nullableString,
  duration: z.number().nullable().optional(),
  state: z.string().nullable().optional(),
  try_number: z.number().int().nonnegative().optional().default(0),
  max_tries: z.number().int().optional().default(0),
  task_display_name: z.string().min(1).optional(),
  operator: z.string().nullable().optional(),
  pool: z.string().nullable().optional(),
  queue: z.string().nullable().optional(),
});
const taskInstanceCollectionSchema = z.object({
  task_instances: z.array(taskInstanceSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const airflow2TaskInstanceSchema = taskInstanceSchema
  .omit({ id: true })
  .extend({
    task_display_name: z.string().min(1).optional(),
  });
const airflow2TaskInstanceCollectionSchema = z.object({
  task_instances: z.array(airflow2TaskInstanceSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const clearedTaskCollectionSchema = z.object({
  task_instances: z.array(z.unknown()).max(100),
});
const taskLogSchema = z.object({
  // Grouping markers such as `::group::` carry no timestamp at all.
  content: z.array(
    z.object({
      timestamp: z.string().nullable().optional(),
      event: z.string(),
    }),
  ),
  continuation_token: z.string().nullable().optional(),
});
const airflow2TaskLogSchema = z.object({
  content: z.string(),
  continuation_token: z.string().nullable().optional(),
});
const assetSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string(),
  uri: z.string(),
  group: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  consuming_dags: z.array(z.object({ dag_id: z.string() })),
  producing_tasks: z.array(
    z.object({ dag_id: z.string(), task_id: z.string() }),
  ),
});
const assetCollectionSchema = z.object({
  assets: z.array(assetSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const assetEventSchema = z.object({
  id: z.number().int().nonnegative(),
  asset_id: z.number().int().nonnegative(),
  timestamp: z.string(),
  source_dag_id: nullableString,
  source_task_id: nullableString,
  source_run_id: nullableString,
  source_map_index: z.number().int().nullable().optional(),
});
const assetEventCollectionSchema = z.object({
  asset_events: z.array(assetEventSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const datasetSchema = z.object({
  id: z.number().int().nonnegative(),
  uri: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  consuming_dags: z.array(z.object({ dag_id: z.string().nullable() })),
  producing_tasks: z.array(
    z.object({
      dag_id: z.string().nullable(),
      task_id: z.string().nullable(),
    }),
  ),
});
const datasetCollectionSchema = z.object({
  datasets: z.array(datasetSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const datasetEventSchema = z.object({
  id: z.number().int().nonnegative().optional(),
  dataset_id: z.number().int().nonnegative(),
  timestamp: z.string(),
  source_dag_id: nullableString,
  source_task_id: nullableString,
  source_run_id: nullableString,
  source_map_index: z.number().int().nullable().optional(),
});
const datasetEventCollectionSchema = z.object({
  dataset_events: z.array(datasetEventSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const connectionSchema = z.object({
  connection_id: z.string().min(1),
  conn_type: z.string().min(1),
  description: nullableString,
  host: nullableString,
  login: nullableString,
  schema: nullableString,
  port: z.number().int().nullable().optional(),
});
const connectionCollectionSchema = z.object({
  connections: z.array(connectionSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const variableSchema = z.object({
  key: z.string().min(1),
  description: nullableString,
  is_encrypted: z.boolean().optional().default(false),
});
const variableCollectionSchema = z.object({
  variables: z.array(variableSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const poolSchema = z.object({
  name: z.string().min(1),
  slots: z.number().int().nonnegative(),
  occupied_slots: z.number().int().nonnegative().optional().default(0),
  running_slots: z.number().int().nonnegative().optional().default(0),
  queued_slots: z.number().int().nonnegative().optional().default(0),
  open_slots: z.number().int().nonnegative().optional().default(0),
  description: nullableString,
});
const poolCollectionSchema = z.object({
  pools: z.array(poolSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});
const userSchema = z.object({
  username: z.string().min(1),
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  active: z.boolean().optional().default(true),
  roles: z
    .array(z.object({ name: z.string() }))
    .optional()
    .default([]),
});
const userCollectionSchema = z.object({
  users: z.array(userSchema).max(100),
  total_entries: z.number().int().nonnegative(),
});

type DagPayload = z.output<typeof dagSchema>;

function normalizeOperator(value: string | null | undefined): string {
  if (
    value === "@task" ||
    value === "_PythonDecoratedOperator" ||
    value === "PythonDecoratedOperator"
  )
    return "Task";
  return value ?? "";
}

function mapDag(dag: DagPayload): DagSummary {
  return {
    dagId: dag.dag_id,
    name: dag.dag_display_name ?? dag.dag_id,
    isPaused: dag.is_paused,
    isStale: dag.is_stale,
    description: dag.description ?? "",
    schedule: dag.timetable_summary ?? "",
    lastParsedTime: dag.last_parsed_time ?? "",
    owners: (dag.owners ?? []).join(", "),
    tags: (dag.tags ?? []).map((tag) => tag.name).join(", "),
    nextRun: dag.next_dagrun_create_after ?? "",
  };
}

function mapAirflow2Dag(dag: z.output<typeof airflow2DagSchema>): DagSummary {
  return {
    dagId: dag.dag_id,
    name: dag.dag_display_name ?? dag.dag_id,
    isPaused: dag.is_paused,
    isStale: dag.is_active === false,
    description: dag.description ?? "",
    schedule: dag.timetable_description ?? "",
    lastParsedTime: dag.last_parsed_time ?? "",
    owners: (dag.owners ?? []).join(", "),
    tags: (dag.tags ?? []).map((tag) => tag.name).join(", "),
    nextRun: dag.next_dagrun_create_after ?? "",
  };
}

function mapDagRun(run: z.output<typeof dagRunSchema>): DagRun {
  return {
    dagRunId: run.dag_run_id,
    dagId: run.dag_id,
    state: run.state,
    runType: run.run_type,
    logicalDate: run.logical_date ?? "",
    runAfter: run.run_after ?? "",
    startDate: run.start_date ?? "",
    endDate: run.end_date ?? "",
    note: run.note ?? "",
  };
}

function mapTaskInstance(
  task: z.output<typeof taskInstanceSchema>,
): TaskInstance {
  return {
    id:
      task.id ||
      `${task.dag_id}:${task.dag_run_id}:${task.task_id}:${task.map_index}`,
    dagId: task.dag_id,
    dagRunId: task.dag_run_id,
    taskId: task.task_id,
    mapIndex: task.map_index,
    name: task.task_display_name ?? task.task_id,
    state: task.state ?? "none",
    tryNumber: task.try_number,
    maxTries: task.max_tries,
    startDate: task.start_date ?? "",
    endDate: task.end_date ?? "",
    duration: task.duration ?? null,
    operator: normalizeOperator(task.operator),
    pool: task.pool ?? "",
    queue: task.queue ?? "",
  };
}

function mapAirflow2TaskInstance(
  task: z.output<typeof airflow2TaskInstanceSchema>,
): TaskInstance {
  return {
    id: `${task.dag_id}:${task.dag_run_id}:${task.task_id}:${task.map_index}`,
    dagId: task.dag_id,
    dagRunId: task.dag_run_id,
    taskId: task.task_id,
    mapIndex: task.map_index,
    name: task.task_display_name ?? task.task_id,
    state: task.state ?? "none",
    tryNumber: task.try_number,
    maxTries: task.max_tries,
    startDate: task.start_date ?? "",
    endDate: task.end_date ?? "",
    duration: task.duration ?? null,
    operator: normalizeOperator(task.operator),
    pool: task.pool ?? "",
    queue: task.queue ?? "",
  };
}

function mapAsset(asset: z.output<typeof assetSchema>): Asset {
  return {
    assetId: asset.id,
    name: asset.name,
    uri: asset.uri,
    group: asset.group,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
    consumingDags: asset.consuming_dags
      .map((reference) => reference.dag_id)
      .join(", "),
    producingTasks: asset.producing_tasks
      .map((reference) => `${reference.dag_id}.${reference.task_id}`)
      .join(", "),
  };
}

function mapDataset(dataset: z.output<typeof datasetSchema>): Asset {
  return {
    assetId: dataset.id,
    name: dataset.uri,
    uri: dataset.uri,
    group: "",
    createdAt: dataset.created_at,
    updatedAt: dataset.updated_at,
    consumingDags: dataset.consuming_dags
      .flatMap((reference) =>
        reference.dag_id === null ? [] : [reference.dag_id],
      )
      .join(", "),
    producingTasks: dataset.producing_tasks
      .flatMap((reference) =>
        reference.dag_id === null || reference.task_id === null
          ? []
          : [`${reference.dag_id}.${reference.task_id}`],
      )
      .join(", "),
  };
}

function mapConnection(
  connection: z.output<typeof connectionSchema>,
): AirflowConnection {
  return {
    connectionId: connection.connection_id,
    connectionType: connection.conn_type,
    description: connection.description ?? "",
    host: connection.host ?? "",
    login: connection.login ?? "",
    schema: connection.schema ?? "",
    port: connection.port ?? null,
  };
}

function mapVariable(
  variable: z.output<typeof variableSchema>,
): AirflowVariable {
  return {
    key: variable.key,
    description: variable.description ?? "",
    isEncrypted: variable.is_encrypted,
  };
}

function mapPool(pool: z.output<typeof poolSchema>): AirflowPool {
  return {
    name: pool.name,
    slots: pool.slots,
    occupiedSlots: pool.occupied_slots,
    runningSlots: pool.running_slots,
    queuedSlots: pool.queued_slots,
    openSlots: pool.open_slots,
    description: pool.description ?? "",
  };
}

function mapUser(user: z.output<typeof userSchema>): AirflowUser {
  return {
    username: user.username,
    name: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    active: user.active,
    roles: user.roles.map((role) => role.name).join(", "),
  };
}

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Airflow base URL must use HTTP(S) without credentials, query, or fragment",
    );
  url.pathname = `${url.pathname
    .replace(/\/api\/v[12]\/?$/, "")
    .replace(/\/+$/, "")}/`;
  return url;
}

export function createAirflowClient(
  config: AirflowHttpConfig,
  fetchFn: typeof fetch = fetch,
): AirflowClient {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const apiVersion = config.apiVersion ?? "v2";
  const isAirflow2 = apiVersion === "v1";
  const basicAuthorization = isAirflow2
    ? `Basic ${Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64")}`
    : undefined;
  const lifetime = new AbortController();
  let accessToken: string | undefined;
  let tokenRequest: Promise<string> | undefined;

  async function readJson(
    response: Response,
    signal: AbortSignal,
  ): Promise<unknown> {
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_RESPONSE_BYTES
    ) {
      await response.body?.cancel();
      throw new Error("Airflow response exceeds byte limit");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Invalid Airflow JSON response");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > MAX_RESPONSE_BYTES)
          throw new Error("Airflow response exceeds byte limit");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("Invalid Airflow JSON response");
    }
  }

  async function request<TSchema extends z.ZodTypeAny>(
    path: string,
    schema: TSchema,
    signal?: AbortSignal,
    init: RequestInit = {},
  ): Promise<z.output<TSchema>> {
    const combinedSignal = AbortSignal.any([
      lifetime.signal,
      ...(signal ? [signal] : []),
    ]);
    combinedSignal.throwIfAborted();
    const send = async (authorization: string) =>
      fetchFn(new URL(`api/${apiVersion}/${path}`, baseUrl), {
        ...init,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "dsui-airflow/0.1",
        },
        redirect: "error",
        signal: combinedSignal,
        verbose: true,
      } as RequestInit);
    let authorization = basicAuthorization;
    if (!authorization)
      authorization = `Bearer ${await getAccessToken(signal)}`;
    let response = await send(authorization);
    if (!isAirflow2 && response.status === 401) {
      await response.body?.cancel();
      if (`Bearer ${accessToken}` === authorization) accessToken = undefined;
      authorization = `Bearer ${await getAccessToken(signal)}`;
      response = await send(authorization);
    }
    if (!response.ok) {
      let detail = "";
      try {
        const body = await readJson(response, combinedSignal);
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const value = (body as Record<string, unknown>).detail;
          if (typeof value === "string") detail = value;
          else if (Array.isArray(value)) {
            detail = value
              .flatMap((item) =>
                item && typeof item === "object" && !Array.isArray(item)
                  ? [(item as Record<string, unknown>).msg]
                  : [],
              )
              .filter(
                (message): message is string => typeof message === "string",
              )
              .join("; ");
          }
        }
      } catch {
        await response.body?.cancel();
      }
      throw new Error(
        `Airflow request failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }
    if (response.status === 204) return undefined as z.output<TSchema>;
    const body = await readJson(response, combinedSignal);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error("Invalid Airflow response");
    return parsed.data;
  }

  async function getAccessToken(signal?: AbortSignal): Promise<string> {
    if (!accessToken) {
      tokenRequest ??= requestAccessToken().finally(() => {
        tokenRequest = undefined;
      });
      accessToken = await tokenRequest;
    }
    signal?.throwIfAborted();
    return accessToken;
  }

  async function requestAccessToken(): Promise<string> {
    lifetime.signal.throwIfAborted();
    const response = await fetchFn(new URL("auth/token", baseUrl), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "dsui-airflow/0.1",
      },
      body: JSON.stringify({
        username: config.username,
        password: config.password,
      }),
      redirect: "error",
      signal: lifetime.signal,
      verbose: true,
    } as RequestInit);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `Airflow authentication failed (HTTP ${response.status})`,
      );
    }
    const body = await readJson(response, lifetime.signal);
    const parsed = tokenResponseSchema.safeParse(body);
    if (!parsed.success)
      throw new Error("Invalid Airflow authentication response");
    return parsed.data.access_token;
  }

  return {
    dispose: () => lifetime.abort(),
    getVersion: async (signal): Promise<AirflowVersion> =>
      request("version", versionResponseSchema, signal),
    listDags: async (signal): Promise<DagSummary[]> => {
      if (isAirflow2) {
        const result = await request(
          "dags?limit=100&offset=0&order_by=dag_id",
          airflow2DagCollectionSchema,
          signal,
        );
        return result.dags.map(mapAirflow2Dag);
      }
      const result = await request(
        "dags?limit=100&offset=0&order_by=dag_id",
        dagCollectionSchema,
        signal,
      );
      return result.dags.map(mapDag);
    },
    getDag: async (dagId, signal): Promise<DagDetails> => {
      if (isAirflow2) {
        const result = await request(
          `dags/${encodeURIComponent(dagId)}`,
          airflow2DagDetailsSchema,
          signal,
        );
        return { ...mapAirflow2Dag(result), fileLocation: result.fileloc };
      }
      const result = await request(
        `dags/${encodeURIComponent(dagId)}/details`,
        dagDetailsSchema,
        signal,
      );
      return { ...mapDag(result), fileLocation: result.fileloc };
    },
    getDagSource: async (dagId, signal): Promise<string> => {
      let sourceId = dagId;
      if (isAirflow2) {
        const dag = await request(
          `dags/${encodeURIComponent(dagId)}`,
          airflow2DagDetailsSchema,
          signal,
        );
        if (!dag.file_token)
          throw new Error("Airflow did not provide a DAG source file token");
        sourceId = dag.file_token;
      }
      return (
        await request(
          `dagSources/${encodeURIComponent(sourceId)}`,
          dagSourceSchema,
          signal,
        )
      ).content;
    },
    listDagTasks: async (dagId, signal): Promise<DagTask[]> => {
      if (isAirflow2) {
        const result = await request(
          `dags/${encodeURIComponent(dagId)}/tasks`,
          airflow2TaskCollectionSchema,
          signal,
        );
        return result.tasks.map((task) => ({
          taskId: task.task_id,
          name: task.task_display_name ?? task.task_id,
          owner: task.owner,
          operator: normalizeOperator(task.class_ref.class_name),
          isMapped: task.is_mapped,
          upstreamTaskIds: result.tasks
            .filter((candidate) =>
              candidate.downstream_task_ids.includes(task.task_id),
            )
            .map((candidate) => candidate.task_id),
          downstreamTaskIds: [...task.downstream_task_ids],
        }));
      }
      const result = await request(
        `dags/${encodeURIComponent(dagId)}/tasks`,
        taskCollectionSchema,
        signal,
      );
      return result.tasks.map((task) => ({
        taskId: task.task_id,
        name: task.task_display_name ?? task.task_id,
        owner: task.owner,
        operator: normalizeOperator(task.operator_name),
        isMapped: task.is_mapped,
        upstreamTaskIds: result.tasks
          .filter((candidate) =>
            candidate.downstream_task_ids.includes(task.task_id),
          )
          .map((candidate) => candidate.task_id),
        downstreamTaskIds: [...task.downstream_task_ids],
      }));
    },
    listDagRuns: async (dagId, signal): Promise<DagRun[]> => {
      const result = await request(
        `dags/${encodeURIComponent(dagId)}/dagRuns?limit=100&offset=0&order_by=${isAirflow2 ? "-execution_date" : "-run_after"}`,
        dagRunCollectionSchema,
        signal,
      );
      return result.dag_runs.map(mapDagRun);
    },
    getDagRun: async (dagId, dagRunId, signal): Promise<DagRun> =>
      mapDagRun(
        await request(
          `dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}`,
          dagRunSchema,
          signal,
        ),
      ),
    listTaskInstances: async (
      dagId,
      dagRunId,
      signal,
    ): Promise<TaskInstance[]> => {
      if (isAirflow2) {
        const result = await request(
          `dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}/taskInstances?limit=100&offset=0`,
          airflow2TaskInstanceCollectionSchema,
          signal,
        );
        return result.task_instances.map(mapAirflow2TaskInstance);
      }
      const result = await request(
        `dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}/taskInstances?limit=100&offset=0&order_by=map_index`,
        taskInstanceCollectionSchema,
        signal,
      );
      return result.task_instances.map(mapTaskInstance);
    },
    getTaskInstance: async (
      input: TaskInstanceRef,
      signal,
    ): Promise<TaskInstance> => {
      const mappedSegment = input.mapIndex >= 0 ? `/${input.mapIndex}` : "";
      const path = `dags/${encodeURIComponent(input.dagId)}/dagRuns/${encodeURIComponent(input.dagRunId)}/taskInstances/${encodeURIComponent(input.taskId)}${mappedSegment}`;
      if (isAirflow2)
        return mapAirflow2TaskInstance(
          await request(path, airflow2TaskInstanceSchema, signal),
        );
      return mapTaskInstance(await request(path, taskInstanceSchema, signal));
    },
    getTaskLog: async (
      input: TaskInstanceRef & { tryNumber: number },
      signal,
    ): Promise<TaskLogEntry[]> => {
      const path = `dags/${encodeURIComponent(input.dagId)}/dagRuns/${encodeURIComponent(input.dagRunId)}/taskInstances/${encodeURIComponent(input.taskId)}/logs/${input.tryNumber}?full_content=true&map_index=${input.mapIndex}`;
      if (isAirflow2) {
        const result = await request(path, airflow2TaskLogSchema, signal);
        return [{ timestamp: "", event: result.content }];
      }
      const result = await request(path, taskLogSchema, signal);
      return result.content.map((entry) => ({
        timestamp: entry.timestamp ?? "",
        event: entry.event,
      }));
    },
    triggerDag: async (dagId, conf, signal): Promise<DagRun> =>
      mapDagRun(
        await request(
          `dags/${encodeURIComponent(dagId)}/dagRuns`,
          dagRunSchema,
          signal,
          {
            method: "POST",
            body: JSON.stringify(
              isAirflow2 ? { conf } : { logical_date: null, conf },
            ),
          },
        ),
      ),
    setDagPaused: async (dagId, isPaused, signal): Promise<DagSummary> => {
      const path = `dags/${encodeURIComponent(dagId)}${
        isAirflow2 ? "" : "?update_mask=is_paused"
      }`;
      const init = {
        method: "PATCH",
        body: JSON.stringify({ is_paused: isPaused }),
      };
      if (isAirflow2)
        return mapAirflow2Dag(
          await request(path, airflow2DagSchema, signal, init),
        );
      return mapDag(await request(path, dagSchema, signal, init));
    },
    setDagRunState: async (dagId, dagRunId, state, signal): Promise<DagRun> =>
      mapDagRun(
        await request(
          `dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}`,
          dagRunSchema,
          signal,
          {
            method: "PATCH",
            body: JSON.stringify({ state }),
          },
        ),
      ),
    clearTaskInstance: async (input, onlyFailed, signal): Promise<void> => {
      if (isAirflow2 && input.mapIndex >= 0)
        throw new Error(
          "Airflow 2 cannot clear one mapped task instance safely",
        );
      await request(
        `dags/${encodeURIComponent(input.dagId)}/clearTaskInstances`,
        isAirflow2 ? clearedTaskCollectionSchema : taskInstanceCollectionSchema,
        signal,
        {
          method: "POST",
          body: JSON.stringify({
            dry_run: false,
            only_failed: onlyFailed,
            only_running: false,
            reset_dag_runs: true,
            task_ids: [
              !isAirflow2 && input.mapIndex >= 0
                ? [input.taskId, input.mapIndex]
                : input.taskId,
            ],
            dag_run_id: input.dagRunId,
            include_upstream: false,
            include_downstream: false,
            include_future: false,
            include_past: false,
          }),
        },
      );
    },
    listAssets: async (signal): Promise<Asset[]> => {
      if (isAirflow2) {
        const result = await request(
          "datasets?limit=100&offset=0&order_by=id",
          datasetCollectionSchema,
          signal,
        );
        return result.datasets.map(mapDataset);
      }
      const result = await request(
        "assets?limit=100&offset=0&order_by=id",
        assetCollectionSchema,
        signal,
      );
      return result.assets.map(mapAsset);
    },
    getAsset: async (assetId, signal): Promise<Asset> => {
      if (isAirflow2) {
        const result = await request(
          "datasets?limit=100&offset=0&order_by=id",
          datasetCollectionSchema,
          signal,
        );
        const dataset = result.datasets.find((item) => item.id === assetId);
        if (!dataset) throw new Error(`Airflow dataset ${assetId} not found`);
        return mapDataset(dataset);
      }
      return mapAsset(await request(`assets/${assetId}`, assetSchema, signal));
    },
    listAssetEvents: async (assetId, signal): Promise<AssetEvent[]> => {
      if (isAirflow2) {
        const result = await request(
          `datasets/events?limit=100&offset=0&order_by=-timestamp&dataset_id=${assetId}`,
          datasetEventCollectionSchema,
          signal,
        );
        return result.dataset_events.map((event) => ({
          eventId: event.id ?? event.dataset_id,
          assetId: event.dataset_id,
          timestamp: event.timestamp,
          sourceDagId: event.source_dag_id ?? "",
          sourceTaskId: event.source_task_id ?? "",
          sourceRunId: event.source_run_id ?? "",
          sourceMapIndex: event.source_map_index ?? null,
        }));
      }
      const result = await request(
        `assets/events?limit=100&offset=0&order_by=-timestamp&asset_id=${assetId}`,
        assetEventCollectionSchema,
        signal,
      );
      return result.asset_events.map((event) => ({
        eventId: event.id,
        assetId: event.asset_id,
        timestamp: event.timestamp,
        sourceDagId: event.source_dag_id ?? "",
        sourceTaskId: event.source_task_id ?? "",
        sourceRunId: event.source_run_id ?? "",
        sourceMapIndex: event.source_map_index ?? null,
      }));
    },
    listConnections: async (signal): Promise<AirflowConnection[]> => {
      const result = await request(
        "connections?limit=100&offset=0&order_by=connection_id",
        connectionCollectionSchema,
        signal,
      );
      return result.connections.map(mapConnection);
    },
    createConnection: async (input, signal): Promise<AirflowConnection> =>
      mapConnection(
        await request("connections", connectionSchema, signal, {
          method: "POST",
          body: JSON.stringify({
            connection_id: input.connectionId,
            conn_type: input.connectionType,
            description: input.description || null,
            host: input.host || null,
            login: input.login || null,
            schema: input.schema || null,
            port: input.port,
            password: input.password || null,
            extra: input.extra || null,
          }),
        }),
      ),
    deleteConnection: async (connectionId, signal): Promise<void> => {
      await request(
        `connections/${encodeURIComponent(connectionId)}`,
        z.unknown(),
        signal,
        { method: "DELETE" },
      );
    },
    listVariables: async (signal): Promise<AirflowVariable[]> => {
      const result = await request(
        "variables?limit=100&offset=0&order_by=key",
        variableCollectionSchema,
        signal,
      );
      return result.variables.map(mapVariable);
    },
    createVariable: async (input, signal): Promise<AirflowVariable> =>
      mapVariable(
        await request("variables", variableSchema, signal, {
          method: "POST",
          body: JSON.stringify({
            key: input.key,
            value: input.value,
            description: input.description || null,
          }),
        }),
      ),
    deleteVariable: async (key, signal): Promise<void> => {
      await request(
        `variables/${encodeURIComponent(key)}`,
        z.unknown(),
        signal,
        { method: "DELETE" },
      );
    },
    listPools: async (signal): Promise<AirflowPool[]> => {
      const result = await request(
        "pools?limit=100&offset=0&order_by=name",
        poolCollectionSchema,
        signal,
      );
      return result.pools.map(mapPool);
    },
    createPool: async (input, signal): Promise<AirflowPool> =>
      mapPool(
        await request("pools", poolSchema, signal, {
          method: "POST",
          body: JSON.stringify({
            name: input.name,
            slots: input.slots,
            description: input.description || null,
            include_deferred: false,
          }),
        }),
      ),
    deletePool: async (name, signal): Promise<void> => {
      await request(`pools/${encodeURIComponent(name)}`, z.unknown(), signal, {
        method: "DELETE",
      });
    },
    listUsers: async (signal): Promise<AirflowUser[]> => {
      if (!isAirflow2) return [];
      const result = await request(
        "users?limit=100&offset=0",
        userCollectionSchema,
        signal,
      );
      return result.users
        .map(mapUser)
        .sort((left, right) => left.username.localeCompare(right.username));
    },
    supportsUserAdministration: () => isAirflow2,
  };
}
