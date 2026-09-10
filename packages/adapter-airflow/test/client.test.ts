import { describe, expect, test } from "bun:test";
import { createAirflowClient } from "../src/client.js";

const config = {
  baseUrl: "https://airflow.example.test/",
  token: "secret-token",
};

const airflow2Config = {
  apiVersion: "v1",
  baseUrl: "https://airflow.example.test/",
  username: "airflow-user",
  password: "secret-password",
} as const;

function fixture(handler: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetchFn = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return handler(request);
    },
    { preconnect: fetch.preconnect },
  );
  return { fetchFn, requests };
}

describe("Airflow client", () => {
  test("authenticates an Airflow 2 API request with basic credentials", async () => {
    const http = fixture(() => Response.json({ version: "2.10.5" }));
    const client = createAirflowClient(airflow2Config, http.fetchFn);

    expect(await client.getVersion()).toEqual({ version: "2.10.5" });
    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]?.url).toBe(
      "https://airflow.example.test/api/v1/version",
    );
    expect(http.requests[0]?.headers.get("authorization")).toBe(
      `Basic ${btoa("airflow-user:secret-password")}`,
    );
  });

  test("authenticates a normalized Airflow 3 API request", async () => {
    const http = fixture(() => Response.json({ version: "3.0.0" }));
    const client = createAirflowClient(config, http.fetchFn);

    expect(await client.getVersion()).toEqual({ version: "3.0.0" });
    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]?.url).toBe(
      "https://airflow.example.test/api/v2/version",
    );
    expect(http.requests[0]?.headers.get("authorization")).toBe(
      "Bearer secret-token",
    );
    expect(http.requests[0]?.redirect).toBe("error");
  });

  test("rejects malformed provider responses", async () => {
    const http = fixture(() => Response.json({ version: 3 }));
    const client = createAirflowClient(config, http.fetchFn);

    await expect(client.getVersion()).rejects.toThrow(
      "Invalid Airflow response",
    );
  });

  test("rejects invalid JSON explicitly", async () => {
    const http = fixture(() => new Response("not json"));
    const client = createAirflowClient(config, http.fetchFn);

    await expect(client.getVersion()).rejects.toThrow(
      "Invalid Airflow JSON response",
    );
  });

  test("rejects response bodies above the byte limit before buffering", async () => {
    const http = fixture(
      () =>
        new Response("{}", {
          headers: { "Content-Length": String(4 * 1024 * 1024 + 1) },
        }),
    );
    const client = createAirflowClient(config, http.fetchFn);

    await expect(client.getVersion()).rejects.toThrow(
      "Airflow response exceeds byte limit",
    );
  });

  test("does not expose provider bodies or bearer tokens in HTTP errors", async () => {
    const http = fixture(
      () => new Response(`provider leaked ${config.token}`, { status: 403 }),
    );
    const client = createAirflowClient(config, http.fetchFn);

    await expect(client.getVersion()).rejects.toThrow(
      "Airflow request failed (HTTP 403)",
    );
    await expect(client.getVersion()).rejects.not.toThrow(config.token);
  });

  test("disposal aborts an in-flight request", async () => {
    let observedSignal: AbortSignal | null | undefined;
    let requestStarted = () => {};
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const fetchFn = Object.assign(
      async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        observedSignal = init?.signal;
        requestStarted();
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        });
      },
      { preconnect: fetch.preconnect },
    );
    const client = createAirflowClient(config, fetchFn);
    const pending = client.getVersion();
    await started;

    client.dispose();

    await expect(pending).rejects.toThrow("aborted");
    expect(observedSignal?.aborted).toBe(true);
  });

  test("lists at most 100 DAGs and maps provider fields", async () => {
    const http = fixture(() =>
      Response.json({
        dags: [
          {
            dag_id: "hourly/load",
            dag_display_name: "Hourly load",
            is_paused: false,
            is_stale: false,
            description: "Loads the warehouse",
            timetable_summary: "0 * * * *",
            last_parsed_time: "2026-09-09T10:00:00Z",
            owners: ["data"],
            tags: [{ name: "production", dag_id: "hourly/load" }],
          },
        ],
        total_entries: 1,
      }),
    );
    const client = createAirflowClient(config, http.fetchFn);

    expect(await client.listDags()).toEqual([
      {
        dagId: "hourly/load",
        name: "Hourly load",
        isPaused: false,
        isStale: false,
        description: "Loads the warehouse",
        schedule: "0 * * * *",
        lastParsedTime: "2026-09-09T10:00:00Z",
        owners: "data",
        tags: "production",
      },
    ]);
    expect(http.requests[0]?.url).toBe(
      "https://airflow.example.test/api/v2/dags?limit=100&offset=0&order_by=dag_id",
    );
  });

  test("encodes DAG ids and derives upstream graph edges", async () => {
    const responses = [
      Response.json({
        dag_id: "hourly/load",
        dag_display_name: "Hourly load",
        is_paused: false,
        is_stale: false,
        fileloc: "/opt/airflow/dags/hourly.py",
        description: "Loads the warehouse",
        timetable_summary: "0 * * * *",
        owners: ["data"],
        tags: [{ name: "production", dag_id: "hourly/load" }],
      }),
      Response.json({
        tasks: [
          {
            task_id: "extract",
            task_display_name: "Extract",
            owner: "data",
            operator_name: "@task",
            is_mapped: false,
            downstream_task_ids: ["load"],
          },
          {
            task_id: "load",
            task_display_name: "Load",
            owner: "data",
            operator_name: "SnowflakeOperator",
            is_mapped: false,
            downstream_task_ids: [],
          },
        ],
        total_entries: 2,
      }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(config, http.fetchFn);

    expect(await client.getDag("hourly/load")).toMatchObject({
      dagId: "hourly/load",
      fileLocation: "/opt/airflow/dags/hourly.py",
    });
    expect(await client.listDagTasks("hourly/load")).toEqual([
      {
        taskId: "extract",
        name: "Extract",
        owner: "data",
        operator: "Task",
        isMapped: false,
        upstreamTaskIds: [],
        downstreamTaskIds: ["load"],
      },
      {
        taskId: "load",
        name: "Load",
        owner: "data",
        operator: "SnowflakeOperator",
        isMapped: false,
        upstreamTaskIds: ["extract"],
        downstreamTaskIds: [],
      },
    ]);
    expect(
      http.requests.map((request) => new URL(request.url).pathname),
    ).toEqual([
      "/api/v2/dags/hourly%2Fload/details",
      "/api/v2/dags/hourly%2Fload/tasks",
    ]);
  });

  test("reads bounded DAG runs and mapped task instances", async () => {
    const responses = [
      Response.json({
        dag_runs: [
          {
            dag_run_id: "manual/2026",
            dag_id: "hourly/load",
            logical_date: null,
            start_date: "2026-09-09T10:00:00Z",
            end_date: null,
            run_after: "2026-09-09T09:59:00Z",
            run_type: "manual",
            state: "running",
            note: null,
          },
        ],
        total_entries: 1,
      }),
      Response.json({
        task_instances: [
          {
            id: "ti-1",
            task_id: "load",
            dag_id: "hourly/load",
            dag_run_id: "manual/2026",
            map_index: 2,
            logical_date: null,
            start_date: "2026-09-09T10:01:00Z",
            end_date: null,
            duration: 3.5,
            state: "running",
            try_number: 1,
            max_tries: 3,
            task_display_name: "Load",
            operator: "SnowflakeOperator",
            pool: "default_pool",
            queue: "default",
          },
        ],
        total_entries: 1,
      }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(config, http.fetchFn);

    expect(await client.listDagRuns("hourly/load")).toMatchObject([
      { dagRunId: "manual/2026", state: "running", runType: "manual" },
    ]);
    expect(
      await client.listTaskInstances("hourly/load", "manual/2026"),
    ).toMatchObject([
      { taskId: "load", mapIndex: 2, tryNumber: 1, state: "running" },
    ]);
    expect(http.requests.map((request) => request.url)).toEqual([
      "https://airflow.example.test/api/v2/dags/hourly%2Fload/dagRuns?limit=100&offset=0&order_by=-run_after",
      "https://airflow.example.test/api/v2/dags/hourly%2Fload/dagRuns/manual%2F2026/taskInstances?limit=100&offset=0&order_by=map_index",
    ]);
  });

  test("reads mapped task details and an explicit full-content log try", async () => {
    const task = {
      id: "ti-1",
      task_id: "load",
      dag_id: "hourly/load",
      dag_run_id: "manual/2026",
      map_index: 2,
      logical_date: null,
      start_date: "2026-09-09T10:01:00Z",
      end_date: null,
      duration: 3.5,
      state: "failed",
      try_number: 2,
      max_tries: 3,
      task_display_name: "Load",
      operator: "SnowflakeOperator",
      pool: "default_pool",
      queue: "default",
    };
    const responses = [
      Response.json(task),
      Response.json({
        content: [
          // Airflow brackets each log with untimestamped grouping markers and
          // decorates real lines with fields the adapter does not surface.
          {
            event: "::group::Log message source details",
            sources: ["/opt/airflow/logs/attempt=2.log"],
          },
          {
            timestamp: "2026-09-09T10:02:00Z",
            event: "Task failed",
            level: "error",
            logger: "airflow.task",
          },
          { event: "::endgroup::" },
        ],
        continuation_token: null,
      }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(config, http.fetchFn);
    const input = {
      dagId: "hourly/load",
      dagRunId: "manual/2026",
      taskId: "load",
      mapIndex: 2,
    };

    expect(await client.getTaskInstance(input)).toMatchObject({
      mapIndex: 2,
      state: "failed",
    });
    expect(await client.getTaskLog({ ...input, tryNumber: 2 })).toEqual([
      { timestamp: "", event: "::group::Log message source details" },
      { timestamp: "2026-09-09T10:02:00Z", event: "Task failed" },
      { timestamp: "", event: "::endgroup::" },
    ]);
    expect(http.requests.map((request) => request.url)).toEqual([
      "https://airflow.example.test/api/v2/dags/hourly%2Fload/dagRuns/manual%2F2026/taskInstances/load/2",
      "https://airflow.example.test/api/v2/dags/hourly%2Fload/dagRuns/manual%2F2026/taskInstances/load/logs/2?full_content=true&map_index=2",
    ]);
  });

  test("triggers and pauses a DAG with documented mutation bodies", async () => {
    const responses = [
      Response.json({
        dag_run_id: "manual__1",
        dag_id: "hourly/load",
        logical_date: null,
        start_date: null,
        end_date: null,
        run_after: "2026-09-09T11:00:00Z",
        run_type: "manual",
        state: "queued",
        note: null,
      }),
      Response.json({
        dag_id: "hourly/load",
        dag_display_name: "Hourly load",
        is_paused: true,
        is_stale: false,
        description: null,
        timetable_summary: "0 * * * *",
        last_parsed_time: "2026-09-09T10:00:00Z",
      }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(config, http.fetchFn);

    expect(
      await client.triggerDag("hourly/load", { partition: "2026-09-09" }),
    ).toMatchObject({ dagRunId: "manual__1", state: "queued" });
    expect(await client.setDagPaused("hourly/load", true)).toMatchObject({
      dagId: "hourly/load",
      isPaused: true,
    });
    expect(http.requests.map((request) => request.method)).toEqual([
      "POST",
      "PATCH",
    ]);
    expect(await http.requests[0]?.json()).toEqual({
      logical_date: null,
      conf: { partition: "2026-09-09" },
    });
    expect(await http.requests[1]?.json()).toEqual({ is_paused: true });
    expect(http.requests[1]?.url).toEndWith(
      "/api/v2/dags/hourly%2Fload?update_mask=is_paused",
    );
  });

  test("clears exactly one mapped task instance for retry", async () => {
    const http = fixture(() =>
      Response.json({ task_instances: [], total_entries: 0 }),
    );
    const client = createAirflowClient(config, http.fetchFn);

    await client.clearTaskInstance(
      {
        dagId: "hourly/load",
        dagRunId: "manual/2026",
        taskId: "load",
        mapIndex: 2,
      },
      true,
    );

    expect(http.requests[0]?.method).toBe("POST");
    expect(http.requests[0]?.url).toBe(
      "https://airflow.example.test/api/v2/dags/hourly%2Fload/clearTaskInstances",
    );
    expect(await http.requests[0]?.json()).toEqual({
      dry_run: false,
      only_failed: true,
      only_running: false,
      reset_dag_runs: true,
      task_ids: [["load", 2]],
      dag_run_id: "manual/2026",
      include_upstream: false,
      include_downstream: false,
      include_future: false,
      include_past: false,
    });
  });

  test("lists asset details and recent events through bounded endpoints", async () => {
    const asset = {
      id: 7,
      name: "orders",
      uri: "s3://warehouse/orders",
      group: "warehouse",
      extra: {},
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-09T00:00:00Z",
      consuming_dags: [
        {
          dag_id: "consume_orders",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-09T00:00:00Z",
        },
      ],
      producing_tasks: [
        {
          dag_id: "warehouse_daily",
          task_id: "load",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-09T00:00:00Z",
        },
      ],
      aliases: [],
    };
    const responses = [
      Response.json({ assets: [asset], total_entries: 1 }),
      Response.json(asset),
      Response.json({
        asset_events: [
          {
            id: 12,
            asset_id: 7,
            uri: asset.uri,
            name: asset.name,
            group: asset.group,
            extra: {},
            source_task_id: "load",
            source_dag_id: "warehouse_daily",
            source_run_id: "scheduled__1",
            source_map_index: -1,
            created_dagruns: [],
            timestamp: "2026-09-09T04:02:00Z",
          },
        ],
        total_entries: 1,
      }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(config, http.fetchFn);

    expect(await client.listAssets()).toMatchObject([
      { assetId: 7, name: "orders", consumingDags: "consume_orders" },
    ]);
    expect(await client.getAsset(7)).toMatchObject({
      producingTasks: "warehouse_daily.load",
    });
    expect(await client.listAssetEvents(7)).toEqual([
      {
        eventId: 12,
        assetId: 7,
        timestamp: "2026-09-09T04:02:00Z",
        sourceDagId: "warehouse_daily",
        sourceTaskId: "load",
        sourceRunId: "scheduled__1",
        sourceMapIndex: -1,
      },
    ]);
    expect(http.requests.map((request) => request.url)).toEqual([
      "https://airflow.example.test/api/v2/assets?limit=100&offset=0&order_by=id",
      "https://airflow.example.test/api/v2/assets/7",
      "https://airflow.example.test/api/v2/assets/events?limit=100&offset=0&order_by=-timestamp&asset_id=7",
    ]);
  });

  test("normalizes Airflow 2 DAGs and tasks", async () => {
    const dag = {
      dag_id: "hourly/load",
      dag_display_name: "Hourly load",
      is_paused: false,
      is_active: true,
      description: "Loads the warehouse",
      timetable_description: "At the top of every hour",
      last_parsed_time: "2026-09-09T10:00:00Z",
      owners: ["data"],
      tags: [{ name: "production" }],
    };
    const responses = [
      Response.json({ dags: [dag], total_entries: 1 }),
      Response.json({ ...dag, fileloc: "/opt/airflow/dags/hourly.py" }),
      Response.json({
        tasks: [
          {
            task_id: "extract",
            task_display_name: "Extract",
            owner: "data",
            class_ref: {
              module_path: "airflow.operators.python",
              class_name: "_PythonDecoratedOperator",
            },
            is_mapped: false,
            downstream_task_ids: ["load"],
          },
          {
            task_id: "load",
            task_display_name: "Load",
            owner: "data",
            class_ref: {
              module_path: "airflow.providers.common.sql",
              class_name: "SQLExecuteQueryOperator",
            },
            is_mapped: true,
            downstream_task_ids: [],
          },
        ],
      }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(airflow2Config, http.fetchFn);

    expect(await client.listDags()).toEqual([
      {
        dagId: "hourly/load",
        name: "Hourly load",
        isPaused: false,
        isStale: false,
        description: "Loads the warehouse",
        schedule: "At the top of every hour",
        lastParsedTime: "2026-09-09T10:00:00Z",
        owners: "data",
        tags: "production",
      },
    ]);
    expect(await client.getDag("hourly/load")).toMatchObject({
      dagId: "hourly/load",
      fileLocation: "/opt/airflow/dags/hourly.py",
    });
    expect(await client.listDagTasks("hourly/load")).toMatchObject([
      { taskId: "extract", operator: "Task" },
      {
        taskId: "load",
        operator: "SQLExecuteQueryOperator",
        upstreamTaskIds: ["extract"],
      },
    ]);
    expect(
      http.requests.map((request) => new URL(request.url).pathname),
    ).toEqual([
      "/api/v1/dags",
      "/api/v1/dags/hourly%2Fload/details",
      "/api/v1/dags/hourly%2Fload/tasks",
    ]);
  });

  test("normalizes Airflow 2 runs, task instances, logs, and mutations", async () => {
    const run = {
      dag_run_id: "manual/2026",
      dag_id: "hourly/load",
      logical_date: "2026-09-09T10:00:00Z",
      start_date: "2026-09-09T10:01:00Z",
      end_date: null,
      run_type: "manual",
      state: "running",
      note: null,
    };
    const task = {
      task_id: "load",
      task_display_name: "Load",
      dag_id: "hourly/load",
      dag_run_id: "manual/2026",
      map_index: -1,
      start_date: "2026-09-09T10:01:00Z",
      end_date: null,
      duration: 3.5,
      state: "failed",
      try_number: 2,
      max_tries: 3,
      operator: "_PythonDecoratedOperator",
      pool: "default_pool",
      queue: "default",
    };
    const responses = [
      Response.json({ dag_runs: [run], total_entries: 1 }),
      Response.json(run),
      Response.json({ task_instances: [task], total_entries: 1 }),
      Response.json(task),
      Response.json({
        content: "first line\nsecond line",
        continuation_token: "",
      }),
      Response.json({ ...run, state: "queued" }),
      Response.json({
        dag_id: "hourly/load",
        dag_display_name: "Hourly load",
        is_paused: true,
        is_active: true,
      }),
      Response.json({ task_instances: [] }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(airflow2Config, http.fetchFn);

    expect(await client.listDagRuns("hourly/load")).toMatchObject([
      { dagRunId: "manual/2026", runAfter: "", state: "running" },
    ]);
    expect(http.requests[0]?.url).toBe(
      "https://airflow.example.test/api/v1/dags/hourly%2Fload/dagRuns?limit=100&offset=0&order_by=-execution_date",
    );
    expect(await client.getDagRun("hourly/load", "manual/2026")).toMatchObject({
      dagRunId: "manual/2026",
    });
    expect(
      await client.listTaskInstances("hourly/load", "manual/2026"),
    ).toMatchObject([
      {
        taskId: "load",
        id: "hourly/load:manual/2026:load:-1",
        operator: "Task",
      },
    ]);
    const input = {
      dagId: "hourly/load",
      dagRunId: "manual/2026",
      taskId: "load",
      mapIndex: -1,
    };
    expect(await client.getTaskInstance(input)).toMatchObject({
      id: "hourly/load:manual/2026:load:-1",
      operator: "Task",
    });
    expect(await client.getTaskLog({ ...input, tryNumber: 2 })).toEqual([
      { timestamp: "", event: "first line\nsecond line" },
    ]);
    await client.triggerDag("hourly/load", { partition: "2026-09-09" });
    await client.setDagPaused("hourly/load", true);
    await client.clearTaskInstance(input, true);

    expect(await http.requests[5]?.json()).toEqual({
      conf: { partition: "2026-09-09" },
    });
    expect(await http.requests[7]?.json()).toMatchObject({
      task_ids: ["load"],
      dag_run_id: "manual/2026",
      only_failed: true,
    });
    await expect(
      client.clearTaskInstance({ ...input, mapIndex: 2 }, false),
    ).rejects.toThrow("Airflow 2 cannot clear one mapped task instance safely");
    expect(http.requests).toHaveLength(8);
  });

  test("normalizes Airflow 2 datasets as assets", async () => {
    const dataset = {
      id: 7,
      uri: "s3://warehouse/orders",
      extra: {},
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-09T00:00:00Z",
      consuming_dags: [{ dag_id: "consume_orders" }],
      producing_tasks: [{ dag_id: "warehouse_daily", task_id: "load" }],
    };
    const responses = [
      Response.json({ datasets: [dataset], total_entries: 1 }),
      Response.json({ datasets: [dataset], total_entries: 1 }),
      Response.json({
        dataset_events: [
          {
            dataset_id: 7,
            dataset_uri: dataset.uri,
            source_task_id: "load",
            source_dag_id: "warehouse_daily",
            source_run_id: "scheduled__1",
            source_map_index: -1,
            timestamp: "2026-09-09T04:02:00Z",
          },
        ],
        total_entries: 1,
      }),
    ];
    const http = fixture(() => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    const client = createAirflowClient(airflow2Config, http.fetchFn);

    expect(await client.listAssets()).toMatchObject([
      {
        assetId: 7,
        name: "s3://warehouse/orders",
        uri: "s3://warehouse/orders",
        group: "",
      },
    ]);
    expect(await client.getAsset(7)).toMatchObject({ assetId: 7 });
    expect(await client.listAssetEvents(7)).toEqual([
      {
        eventId: 7,
        assetId: 7,
        timestamp: "2026-09-09T04:02:00Z",
        sourceDagId: "warehouse_daily",
        sourceTaskId: "load",
        sourceRunId: "scheduled__1",
        sourceMapIndex: -1,
      },
    ]);
    expect(http.requests.map((request) => request.url)).toEqual([
      "https://airflow.example.test/api/v1/datasets?limit=100&offset=0&order_by=id",
      "https://airflow.example.test/api/v1/datasets?limit=100&offset=0&order_by=id",
      "https://airflow.example.test/api/v1/datasets/events?limit=100&offset=0&order_by=-timestamp&dataset_id=7",
    ]);
  });

  test("rejects provider collections that exceed the adapter bound", async () => {
    const assets = Array.from({ length: 101 }, (_, id) => ({
      id,
      name: `asset-${id}`,
      uri: `asset://${id}`,
      group: "default",
      extra: {},
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
      consuming_dags: [],
      producing_tasks: [],
      aliases: [],
    }));
    const http = fixture(() =>
      Response.json({ assets, total_entries: assets.length }),
    );

    await expect(
      createAirflowClient(config, http.fetchFn).listAssets(),
    ).rejects.toThrow("Invalid Airflow response");
  });
});
