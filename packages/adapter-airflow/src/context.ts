import { z } from "@northgraindata/dsui-adapter-sdk";

export const airflowConnectionSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1),
});

export type AirflowHttpConfig = z.output<typeof airflowConnectionSchema>;
export type AirflowConfig = { method: "airflow" } & AirflowHttpConfig;

export interface AirflowVersion {
  version: string;
}

export interface DagSummary {
  dagId: string;
  name: string;
  isPaused: boolean;
  isStale: boolean;
  description: string;
  schedule: string;
  lastParsedTime: string;
  owners: string;
  tags: string;
}

export interface DagDetails extends DagSummary {
  fileLocation: string;
}

export interface DagTask {
  taskId: string;
  name: string;
  owner: string;
  operator: string;
  isMapped: boolean;
  upstreamTaskIds: string[];
  downstreamTaskIds: string[];
}

export interface DagRun {
  dagRunId: string;
  dagId: string;
  state: string;
  runType: string;
  logicalDate: string;
  runAfter: string;
  startDate: string;
  endDate: string;
  note: string;
}

export interface TaskInstanceRef {
  dagId: string;
  dagRunId: string;
  taskId: string;
  mapIndex: number;
}

export interface TaskInstance extends TaskInstanceRef {
  id: string;
  name: string;
  state: string;
  tryNumber: number;
  maxTries: number;
  startDate: string;
  endDate: string;
  duration: number | null;
  operator: string;
  pool: string;
  queue: string;
}

export interface TaskLogEntry {
  timestamp: string;
  event: string;
}

export interface Asset {
  assetId: number;
  name: string;
  uri: string;
  group: string;
  createdAt: string;
  updatedAt: string;
  consumingDags: string;
  producingTasks: string;
}

export interface AssetEvent {
  eventId: number;
  assetId: number;
  timestamp: string;
  sourceDagId: string;
  sourceTaskId: string;
  sourceRunId: string;
  sourceMapIndex: number | null;
}

export interface AirflowClient {
  dispose(): void;
  getVersion(signal?: AbortSignal): Promise<AirflowVersion>;
  listDags(signal?: AbortSignal): Promise<DagSummary[]>;
  getDag(dagId: string, signal?: AbortSignal): Promise<DagDetails>;
  listDagTasks(dagId: string, signal?: AbortSignal): Promise<DagTask[]>;
  listDagRuns(dagId: string, signal?: AbortSignal): Promise<DagRun[]>;
  getDagRun(
    dagId: string,
    dagRunId: string,
    signal?: AbortSignal,
  ): Promise<DagRun>;
  listTaskInstances(
    dagId: string,
    dagRunId: string,
    signal?: AbortSignal,
  ): Promise<TaskInstance[]>;
  getTaskInstance(
    input: TaskInstanceRef,
    signal?: AbortSignal,
  ): Promise<TaskInstance>;
  getTaskLog(
    input: TaskInstanceRef & { tryNumber: number },
    signal?: AbortSignal,
  ): Promise<TaskLogEntry[]>;
  triggerDag(
    dagId: string,
    conf: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<DagRun>;
  setDagPaused(
    dagId: string,
    isPaused: boolean,
    signal?: AbortSignal,
  ): Promise<DagSummary>;
  clearTaskInstance(
    input: TaskInstanceRef,
    onlyFailed: boolean,
    signal?: AbortSignal,
  ): Promise<void>;
  listAssets(signal?: AbortSignal): Promise<Asset[]>;
  getAsset(assetId: number, signal?: AbortSignal): Promise<Asset>;
  listAssetEvents(assetId: number, signal?: AbortSignal): Promise<AssetEvent[]>;
}

export interface AirflowContext {
  client: AirflowClient;
  config: AirflowConfig;
}

export function createContext(
  client: AirflowClient,
  config: AirflowConfig,
): AirflowContext {
  return { client, config };
}
