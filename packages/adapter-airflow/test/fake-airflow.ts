/**
 * Test double for `AirflowClient`. It is stateful so action tests can observe
 * their own mutations, and it lives here rather than in `src` because the
 * adapter ships no fixture mode: real deployments are the only data source.
 */
import type {
  AirflowClient,
  Asset,
  AssetEvent,
  DagDetails,
  DagRun,
  DagSummary,
  DagTask,
  TaskInstance,
} from "../src/context.js";

const defaultDags: DagDetails[] = [
  {
    dagId: "warehouse_daily",
    name: "Warehouse daily",
    isPaused: false,
    isStale: false,
    description: "Loads the daily warehouse model",
    schedule: "0 4 * * *",
    lastParsedTime: "2026-09-09T10:00:00Z",
    owners: "data",
    tags: "production",
    fileLocation: "/opt/airflow/dags/warehouse_daily.py",
  },
];

const defaultTasks: Record<string, DagTask[]> = {
  warehouse_daily: [
    {
      taskId: "extract",
      name: "Extract",
      owner: "data",
      operator: "PythonOperator",
      isMapped: false,
      upstreamTaskIds: [],
      downstreamTaskIds: ["load"],
    },
    {
      taskId: "extract_events",
      name: "Extract events",
      owner: "data",
      operator: "HttpOperator",
      isMapped: false,
      upstreamTaskIds: [],
      downstreamTaskIds: ["stage_events"],
    },
    {
      taskId: "load",
      name: "Load",
      owner: "data",
      operator: "SnowflakeOperator",
      isMapped: false,
      upstreamTaskIds: ["extract"],
      downstreamTaskIds: ["quality_check"],
    },
    {
      taskId: "stage_events",
      name: "Stage events",
      owner: "data",
      operator: "PythonOperator",
      isMapped: true,
      upstreamTaskIds: ["extract_events"],
      downstreamTaskIds: ["quality_check"],
    },
    {
      taskId: "quality_check",
      name: "Quality check",
      owner: "analytics",
      operator: "SQLColumnCheckOperator",
      isMapped: false,
      upstreamTaskIds: ["load", "stage_events"],
      downstreamTaskIds: ["publish_marts"],
    },
    {
      taskId: "publish_marts",
      name: "Publish marts",
      owner: "analytics",
      operator: "DbtRunOperator",
      isMapped: false,
      upstreamTaskIds: ["quality_check"],
      downstreamTaskIds: ["refresh_dashboard", "notify"],
    },
    {
      taskId: "refresh_dashboard",
      name: "Refresh dashboard",
      owner: "analytics",
      operator: "HttpOperator",
      isMapped: false,
      upstreamTaskIds: ["publish_marts"],
      downstreamTaskIds: ["notify"],
    },
    {
      taskId: "notify",
      name: "Notify",
      owner: "platform",
      operator: "SlackWebhookOperator",
      isMapped: false,
      upstreamTaskIds: ["publish_marts", "refresh_dashboard"],
      downstreamTaskIds: [],
    },
  ],
};

const defaultRuns: DagRun[] = [
  {
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    dagId: "warehouse_daily",
    state: "failed",
    runType: "scheduled",
    logicalDate: "2026-09-09T04:00:00Z",
    runAfter: "2026-09-09T04:00:00Z",
    startDate: "2026-09-09T04:00:01Z",
    endDate: "2026-09-09T04:02:00Z",
    note: "",
  },
];

const defaultTaskInstances: TaskInstance[] = [
  {
    id: "ti-extract",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "extract",
    mapIndex: -1,
    name: "Extract",
    state: "success",
    tryNumber: 1,
    maxTries: 2,
    startDate: "2026-09-09T04:00:01Z",
    endDate: "2026-09-09T04:01:00Z",
    duration: 59,
    operator: "PythonOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-extract-events",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "extract_events",
    mapIndex: -1,
    name: "Extract events",
    state: "success",
    tryNumber: 1,
    maxTries: 2,
    startDate: "2026-09-09T04:00:01Z",
    endDate: "2026-09-09T04:00:48Z",
    duration: 47,
    operator: "HttpOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-load",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "load",
    mapIndex: -1,
    name: "Load",
    state: "failed",
    tryNumber: 2,
    maxTries: 2,
    startDate: "2026-09-09T04:01:01Z",
    endDate: "2026-09-09T04:02:00Z",
    duration: 59,
    operator: "SnowflakeOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-stage-events-0",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "stage_events",
    mapIndex: 0,
    name: "Stage events [0]",
    state: "success",
    tryNumber: 1,
    maxTries: 2,
    startDate: "2026-09-09T04:00:50Z",
    endDate: "2026-09-09T04:01:20Z",
    duration: 30,
    operator: "PythonOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-stage-events-1",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "stage_events",
    mapIndex: 1,
    name: "Stage events [1]",
    state: "success",
    tryNumber: 1,
    maxTries: 2,
    startDate: "2026-09-09T04:00:50Z",
    endDate: "2026-09-09T04:01:25Z",
    duration: 35,
    operator: "PythonOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-quality-check",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "quality_check",
    mapIndex: -1,
    name: "Quality check",
    state: "upstream_failed",
    tryNumber: 0,
    maxTries: 1,
    startDate: "",
    endDate: "",
    duration: null,
    operator: "SQLColumnCheckOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-publish-marts",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "publish_marts",
    mapIndex: -1,
    name: "Publish marts",
    state: "none",
    tryNumber: 0,
    maxTries: 1,
    startDate: "",
    endDate: "",
    duration: null,
    operator: "DbtRunOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-refresh-dashboard",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "refresh_dashboard",
    mapIndex: -1,
    name: "Refresh dashboard",
    state: "none",
    tryNumber: 0,
    maxTries: 1,
    startDate: "",
    endDate: "",
    duration: null,
    operator: "HttpOperator",
    pool: "default_pool",
    queue: "default",
  },
  {
    id: "ti-notify",
    dagId: "warehouse_daily",
    dagRunId: "scheduled__2026-09-09T04:00:00Z",
    taskId: "notify",
    mapIndex: -1,
    name: "Notify",
    state: "none",
    tryNumber: 0,
    maxTries: 1,
    startDate: "",
    endDate: "",
    duration: null,
    operator: "SlackWebhookOperator",
    pool: "default_pool",
    queue: "default",
  },
];

const defaultAssets: Asset[] = [
  {
    assetId: 7,
    name: "orders",
    uri: "s3://warehouse/orders",
    group: "warehouse",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-09T04:02:00Z",
    consumingDags: "orders_quality",
    producingTasks: "warehouse_daily.load",
  },
];

const defaultAssetEvents: AssetEvent[] = [
  {
    eventId: 12,
    assetId: 7,
    timestamp: "2026-09-09T04:02:00Z",
    sourceDagId: "warehouse_daily",
    sourceTaskId: "load",
    sourceRunId: "scheduled__2026-09-09T04:00:00Z",
    sourceMapIndex: -1,
  },
];

function copy<T>(value: T): T {
  return structuredClone(value);
}

export function createFakeAirflowClient(): AirflowClient {
  const dagRows = copy(defaultDags);
  const taskRows = copy(defaultTasks);
  const runRows = copy(defaultRuns);
  const taskInstanceRows = copy(defaultTaskInstances);
  const assetRows = copy(defaultAssets);
  const assetEventRows = copy(defaultAssetEvents);
  return {
    dispose() {},
    async getVersion() {
      return { version: "3.0.0" };
    },
    async listDags(): Promise<DagSummary[]> {
      return copy(dagRows);
    },
    async getDag(dagId) {
      const dag = dagRows.find((candidate) => candidate.dagId === dagId);
      if (!dag) throw new Error(`Unknown DAG: ${dagId}`);
      return copy(dag);
    },
    async listDagTasks(dagId) {
      return copy(taskRows[dagId] ?? []);
    },
    async listDagRuns(dagId) {
      return copy(runRows.filter((run) => run.dagId === dagId));
    },
    async getDagRun(dagId, dagRunId) {
      const run = runRows.find(
        (candidate) =>
          candidate.dagId === dagId && candidate.dagRunId === dagRunId,
      );
      if (!run) throw new Error(`Unknown DAG run: ${dagId}/${dagRunId}`);
      return copy(run);
    },
    async listTaskInstances(dagId, dagRunId) {
      return copy(
        taskInstanceRows.filter(
          (task) => task.dagId === dagId && task.dagRunId === dagRunId,
        ),
      );
    },
    async getTaskInstance(input) {
      const task = taskInstanceRows.find(
        (candidate) =>
          candidate.dagId === input.dagId &&
          candidate.dagRunId === input.dagRunId &&
          candidate.taskId === input.taskId &&
          candidate.mapIndex === input.mapIndex,
      );
      if (!task) throw new Error(`Unknown task instance: ${input.taskId}`);
      return copy(task);
    },
    async getTaskLog(input) {
      const task = await this.getTaskInstance(input);
      return [
        {
          timestamp: task.endDate || task.startDate,
          event: `${task.taskId} try ${input.tryNumber}: ${task.state}`,
        },
      ];
    },
    async triggerDag(dagId) {
      const dag = dagRows.find((candidate) => candidate.dagId === dagId);
      if (!dag) throw new Error(`Unknown DAG: ${dagId}`);
      const sequence = runRows.filter((run) => run.dagId === dagId).length + 1;
      const run: DagRun = {
        dagRunId: `manual__${sequence}`,
        dagId,
        state: "queued",
        runType: "manual",
        logicalDate: "",
        runAfter: "2026-09-09T12:00:00Z",
        startDate: "",
        endDate: "",
        note: "",
      };
      runRows.unshift(run);
      return copy(run);
    },
    async setDagPaused(dagId, isPaused) {
      const dag = dagRows.find((candidate) => candidate.dagId === dagId);
      if (!dag) throw new Error(`Unknown DAG: ${dagId}`);
      dag.isPaused = isPaused;
      return copy(dag);
    },
    async clearTaskInstance(input, onlyFailed) {
      const task = taskInstanceRows.find(
        (candidate) =>
          candidate.dagId === input.dagId &&
          candidate.dagRunId === input.dagRunId &&
          candidate.taskId === input.taskId &&
          candidate.mapIndex === input.mapIndex,
      );
      if (!task) throw new Error(`Unknown task instance: ${input.taskId}`);
      if (onlyFailed && task.state !== "failed") return;
      task.state = "none";
      task.startDate = "";
      task.endDate = "";
      task.duration = null;
      const run = runRows.find(
        (candidate) =>
          candidate.dagId === input.dagId &&
          candidate.dagRunId === input.dagRunId,
      );
      if (run) {
        run.state = "queued";
        run.endDate = "";
      }
    },
    async listAssets() {
      return copy(assetRows);
    },
    async getAsset(assetId) {
      const asset = assetRows.find(
        (candidate) => candidate.assetId === assetId,
      );
      if (!asset) throw new Error(`Unknown asset: ${assetId}`);
      return copy(asset);
    },
    async listAssetEvents(assetId) {
      return copy(assetEventRows.filter((event) => event.assetId === assetId));
    },
  };
}
