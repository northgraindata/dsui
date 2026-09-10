import { expect, test } from "bun:test";
import {
  type ComponentNode,
  createAdapterInstance,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import { pauseDag, triggerDag, unpauseDag } from "../src/actions/dags.js";
import { clearTask, retryTask } from "../src/actions/tasks.js";
import { createAirflowAdapter } from "../src/adapter.js";
import { assetDetails, assetEvents, assets } from "../src/resources/assets.js";
import { dagDetails, dags, dagTasks } from "../src/resources/dags.js";
import {
  dagRunDetails,
  dagRuns,
  taskInstanceDetails,
  taskInstanceGraph,
  taskInstances,
  taskLog,
} from "../src/resources/runs.js";
import { createFakeAirflowClient } from "./fake-airflow.js";

const CONFIG = {
  method: "airflow",
  baseUrl: "https://airflow.test",
  token: "test-token",
} as const;

function childNodes(
  value: ComponentNode | readonly ComponentNode[],
): ComponentNode[] {
  return "kind" in value ? [value] : [...value];
}

function nodes(scope: {
  render(): ComponentNode | readonly ComponentNode[];
}): ComponentNode[] {
  return childNodes(scope.render());
}

test("airflow adapter registers every requested capability", () => {
  const adapter = createAirflowAdapter(() => createFakeAirflowClient());
  expect(adapter.metadata.id).toBe("airflow");
  expect(adapter.resources.map((resource) => resource.id)).toEqual([
    "dags",
    "dag-details",
    "dag-tasks",
    "dag-runs",
    "dag-run-details",
    "task-instances",
    "task-instance-graph",
    "task-instance-details",
    "task-log",
    "assets",
    "asset-details",
    "asset-events",
  ]);
  expect(adapter.actions.map((action) => action.id)).toEqual([
    "trigger-dag",
    "pause-dag",
    "unpause-dag",
    "retry-task",
    "clear-task",
  ]);
  expect(adapter.pages.map((page) => page.path)).toEqual([
    "/dags",
    "/dags/:dagId",
    "/dags/:dagId/runs/:dagRunId",
    "/dags/:dagId/runs/:dagRunId/tasks/:taskId/:mapIndex/:tryNumber",
    "/assets",
    "/assets/:assetId",
  ]);
});

test("DAG pages bind list, details, and dependency graph resources", async () => {
  const instance = await createAdapterInstance(
    createAirflowAdapter(() => createFakeAirflowClient()),
    CONFIG,
  );
  try {
    const list = await instance.executeResource(dags());
    expect(list.status).toBe("success");
    if (list.status === "success")
      expect(list.data.map((dag) => dag.dagId)).toContain("warehouse_daily");

    const listScope = instance.createPageScope("/dags");
    const listNodes = nodes(listScope);
    expect(serializeNodes(listNodes)[0]).toMatchObject({
      kind: "page-header",
      props: {
        title: "DAGs",
        description: "Monitor schedules and start or pause workflows.",
      },
    });
    const listTable = listNodes.find((node) => node.kind === "table");
    expect(listTable?.kind === "table" && listTable.props.rowLink).toEqual({
      path: "/dags/:dagId",
      params: { dagId: "dagId" },
    });
    expect(listTable?.kind === "table" && listTable.props.columns).toEqual([
      { id: "name", label: "DAG" },
      { id: "schedule", label: "Schedule" },
      { id: "owners", label: "Owners" },
      { id: "isPaused", label: "Paused" },
      { id: "lastParsedTime", label: "Last parsed" },
    ]);
    listScope.dispose();

    const detailScope = instance.createPageScope("/dags/warehouse_daily");
    expect(detailScope.params).toEqual({ dagId: "warehouse_daily" });
    const tabs = nodes(detailScope).find((node) => node.kind === "tabs");
    expect(
      tabs?.kind === "tabs" && tabs.props.items.map((item) => item.label),
    ).toEqual(["Details", "Graph", "Runs"]);
    const graphTab =
      tabs?.kind === "tabs"
        ? tabs.props.items.find((item) => item.label === "Graph")
        : undefined;
    expect(graphTab && serializeNodes(graphTab.content)).toEqual([
      {
        kind: "dependency-graph",
        props: {
          source: {
            resourceId: "dag-tasks",
            input: { dagId: "warehouse_daily" },
          },
          idField: "taskId",
          dependsOnField: "upstreamTaskIds",
          labelField: "name",
          detailField: "operator",
        },
      },
    ]);
    expect(serializeNodes(nodes(detailScope))).toContainEqual({
      kind: "button",
      props: {
        label: "Trigger",
        icon: "play",
        variant: "primary",
        action: {
          actionId: "trigger-dag",
          input: { dagId: "warehouse_daily", conf: {} },
        },
        successLink: {
          path: "/dags/:dagId/runs/:dagRunId",
          params: { dagId: "dagId", dagRunId: "dagRunId" },
        },
      },
    });

    expect(
      await instance.executeResource(dagDetails({ dagId: "warehouse_daily" })),
    ).toMatchObject({ status: "success" });
    const graph = await instance.executeResource(
      dagTasks({ dagId: "warehouse_daily" }),
    );
    expect(graph.status).toBe("success");
    if (graph.status === "success")
      expect(
        graph.data.find((task) => task.taskId === "load")?.upstreamTaskIds,
      ).toEqual(["extract"]);
    detailScope.dispose();
  } finally {
    await instance.dispose();
  }
});

test("run pages preserve DAG run, mapped task, and log try identity", async () => {
  const instance = await createAdapterInstance(
    createAirflowAdapter(() => createFakeAirflowClient()),
    CONFIG,
  );
  try {
    const runs = await instance.executeResource(
      dagRuns({ dagId: "warehouse_daily" }),
    );
    expect(runs.status).toBe("success");
    if (runs.status !== "success") throw new Error("expected runs");
    const runId = runs.data[0]?.dagRunId;
    if (!runId) throw new Error("expected run id");

    const runInput = { dagId: "warehouse_daily", dagRunId: runId };
    expect(
      await instance.executeResource(dagRunDetails(runInput)),
    ).toMatchObject({
      status: "success",
    });
    const taskResult = await instance.executeResource(taskInstances(runInput));
    if (taskResult.status !== "success") throw new Error("expected tasks");
    const task = taskResult.data.find(
      (candidate) => candidate.taskId === "load",
    );
    if (!task) throw new Error("expected load task");
    const graphResult = await instance.executeResource(
      taskInstanceGraph(runInput),
    );
    if (graphResult.status !== "success") throw new Error("expected graph");
    expect(
      graphResult.data.find((candidate) => candidate.taskId === "load"),
    ).toMatchObject({
      graphId: "load",
      upstreamGraphIds: ["extract"],
      state: "failed",
    });
    expect(
      graphResult.data
        .filter((candidate) => candidate.taskId === "stage_events")
        .map((candidate) => [candidate.graphId, candidate.state]),
    ).toEqual([
      ["stage_events[0]", "success"],
      ["stage_events[1]", "success"],
    ]);
    const taskInput = {
      ...runInput,
      taskId: task.taskId,
      mapIndex: task.mapIndex,
    };
    expect(
      await instance.executeResource(taskInstanceDetails(taskInput)),
    ).toMatchObject({ status: "success" });
    expect(
      await instance.executeResource(
        taskLog({ ...taskInput, tryNumber: task.tryNumber }),
      ),
    ).toMatchObject({ status: "success" });

    const runScope = instance.createPageScope(
      `/dags/warehouse_daily/runs/${encodeURIComponent(runId)}`,
    );
    const runTabs = nodes(runScope).find((node) => node.kind === "tabs");
    expect(
      runTabs?.kind === "tabs" && runTabs.props.items.map((item) => item.label),
    ).toEqual(["Graph", "Details", "Tasks"]);
    expect(
      runTabs?.kind === "tabs" &&
        serializeNodes(runTabs.props.items[0]?.content ?? []),
    ).toEqual([
      {
        kind: "dependency-graph",
        props: {
          source: {
            resourceId: "task-instance-graph",
            input: runInput,
            refresh: { kind: "poll", intervalMs: 2000 },
          },
          idField: "graphId",
          dependsOnField: "upstreamGraphIds",
          labelField: "name",
          detailField: "operator",
          stateField: "state",
          rowLink: {
            path: `/dags/warehouse_daily/runs/${encodeURIComponent(runId)}/tasks/:taskId/:mapIndex/:tryNumber`,
            params: {
              taskId: "taskId",
              mapIndex: "mapIndex",
              tryNumber: "tryNumber",
            },
          },
        },
      },
    ]);
    const taskTab =
      runTabs?.kind === "tabs"
        ? runTabs.props.items.find((item) => item.label === "Tasks")
        : undefined;
    const runTable = taskTab
      ? childNodes(taskTab.content).find((node) => node.kind === "table")
      : undefined;
    expect(runTable?.kind === "table" && runTable.props.rowLink).toEqual({
      path: `/dags/warehouse_daily/runs/${encodeURIComponent(runId)}/tasks/:taskId/:mapIndex/:tryNumber`,
      params: {
        taskId: "taskId",
        mapIndex: "mapIndex",
        tryNumber: "tryNumber",
      },
    });
    expect(runTable?.kind === "table" && runTable.props.columns).toEqual([
      { id: "name", label: "Task" },
      { id: "state", label: "State" },
      { id: "tryNumber", label: "Try" },
      { id: "duration", label: "Duration (s)" },
      { id: "operator", label: "Operator" },
    ]);
    runScope.dispose();
  } finally {
    await instance.dispose();
  }
});

test("DAG actions mutate isolated state and expose row controls", async () => {
  const first = await createAdapterInstance(
    createAirflowAdapter(() => createFakeAirflowClient()),
    CONFIG,
  );
  const second = await createAdapterInstance(
    createAirflowAdapter(() => createFakeAirflowClient()),
    CONFIG,
  );
  try {
    expect(
      await first.executeAction(
        triggerDag({ dagId: "warehouse_daily", conf: { partition: "today" } }),
      ),
    ).toMatchObject({ status: "success" });
    const runsAfterTrigger = await first.executeResource(
      dagRuns({ dagId: "warehouse_daily" }),
    );
    if (runsAfterTrigger.status !== "success") throw new Error("expected runs");
    expect(runsAfterTrigger.data).toHaveLength(2);

    expect(
      await first.executeAction(pauseDag({ dagId: "warehouse_daily" })),
    ).toEqual({
      status: "success",
      data: { dagId: "warehouse_daily", isPaused: true },
    });
    const paused = await first.executeResource(
      dagDetails({ dagId: "warehouse_daily" }),
    );
    expect(paused).toMatchObject({
      status: "success",
      data: { isPaused: true },
    });
    const isolated = await second.executeResource(
      dagDetails({ dagId: "warehouse_daily" }),
    );
    expect(isolated).toMatchObject({
      status: "success",
      data: { isPaused: false },
    });
    expect(
      await first.executeAction(unpauseDag({ dagId: "warehouse_daily" })),
    ).toMatchObject({ status: "success", data: { isPaused: false } });

    const listScope = first.createPageScope("/dags");
    const table = nodes(listScope).find((node) => node.kind === "table");
    expect(
      table?.kind === "table" &&
        table.props.rowActions?.map((action) => [
          action.label,
          action.icon,
          action.successLink?.path,
        ]),
    ).toEqual([
      ["Trigger", "play", "/dags/:dagId/runs/:dagRunId"],
      ["Pause", "pause", undefined],
      ["Unpause", "resume", undefined],
    ]);
    listScope.dispose();
  } finally {
    await first.dispose();
    await second.dispose();
  }
});

test("retry and clear only the selected task instance", async () => {
  const instance = await createAdapterInstance(
    createAirflowAdapter(() => createFakeAirflowClient()),
    CONFIG,
  );
  try {
    const input = {
      dagId: "warehouse_daily",
      dagRunId: "scheduled__2026-09-09T04:00:00Z",
      taskId: "load",
      mapIndex: -1,
    };
    expect(
      await instance.executeAction(retryTask({ ...input, state: "failed" })),
    ).toEqual({
      status: "success",
      data: { ...input, operation: "retry" },
    });
    const retried = await instance.executeResource(taskInstanceDetails(input));
    expect(retried).toMatchObject({
      status: "success",
      data: { state: "none" },
    });

    const successInput = { ...input, taskId: "extract" };
    expect(await instance.executeAction(clearTask(successInput))).toMatchObject(
      {
        status: "success",
        data: { operation: "clear" },
      },
    );
    const cleared = await instance.executeResource(
      taskInstanceDetails(successInput),
    );
    expect(cleared).toMatchObject({
      status: "success",
      data: { state: "none" },
    });

    // @ts-expect-error Retry accepts failed task instances only.
    expect(() => retryTask({ ...successInput, state: "success" })).toThrow();
    const runScope = instance.createPageScope(
      "/dags/warehouse_daily/runs/scheduled__2026-09-09T04%3A00%3A00Z",
    );
    const tabs = nodes(runScope).find((node) => node.kind === "tabs");
    const taskTab =
      tabs?.kind === "tabs"
        ? tabs.props.items.find((item) => item.label === "Tasks")
        : undefined;
    const table = taskTab
      ? childNodes(taskTab.content).find((node) => node.kind === "table")
      : undefined;
    expect(
      table?.kind === "table" &&
        table.props.rowActions?.map((action) => [action.label, action.icon]),
    ).toEqual([
      ["Retry", "retry"],
      ["Clear", "clear"],
    ]);
    runScope.dispose();
  } finally {
    await instance.dispose();
  }
});

test("asset pages bind list, details, and recent event resources", async () => {
  const instance = await createAdapterInstance(
    createAirflowAdapter(() => createFakeAirflowClient()),
    CONFIG,
  );
  try {
    const list = await instance.executeResource(assets());
    if (list.status !== "success") throw new Error("expected assets");
    expect(list.data.map((asset) => asset.assetId)).toEqual([7]);

    expect(
      await instance.executeResource(assetDetails({ assetId: 7 })),
    ).toMatchObject({ status: "success", data: { name: "orders" } });
    expect(
      await instance.executeResource(assetEvents({ assetId: 7 })),
    ).toMatchObject({ status: "success" });

    const listScope = instance.createPageScope("/assets");
    const listNodes = nodes(listScope);
    expect(serializeNodes(listNodes)[0]).toMatchObject({
      kind: "page-header",
      props: {
        description: "Browse Airflow 3 assets or Airflow 2 datasets.",
      },
    });
    const table = listNodes.find((node) => node.kind === "table");
    expect(table?.kind === "table" && table.props.rowLink).toEqual({
      path: "/assets/:assetId",
      params: { assetId: "assetId" },
    });
    expect(table?.kind === "table" && table.props.columns).toEqual([
      { id: "name", label: "Asset" },
      { id: "uri", label: "URI" },
      { id: "group", label: "Group" },
      { id: "updatedAt", label: "Updated" },
    ]);
    listScope.dispose();

    const detailScope = instance.createPageScope("/assets/7");
    const tabs = nodes(detailScope).find((node) => node.kind === "tabs");
    expect(
      tabs?.kind === "tabs" && tabs.props.items.map((item) => item.label),
    ).toEqual(["Details", "Events"]);
    detailScope.dispose();
  } finally {
    await instance.dispose();
  }
});
