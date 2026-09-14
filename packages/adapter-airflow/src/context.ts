import { z } from "@northgraindata/dsui-adapter-sdk";

export const airflowConnectionSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const airflow2ConnectionSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

type Airflow3HttpConfig = z.output<typeof airflowConnectionSchema> & {
  apiVersion?: "v2";
};
type Airflow2HttpConfig = z.output<typeof airflow2ConnectionSchema> & {
  apiVersion: "v1";
};
export type AirflowHttpConfig = Airflow3HttpConfig | Airflow2HttpConfig;
export type AirflowConfig =
  | ({ method: "airflow" } & Airflow3HttpConfig)
  | ({ method: "airflow-2" } & Omit<Airflow2HttpConfig, "apiVersion">);

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
  nextRun: string;
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

export interface AirflowConnection {
  connectionId: string;
  connectionType: string;
  description: string;
  host: string;
  login: string;
  schema: string;
  port: number | null;
}

export interface AirflowVariable {
  key: string;
  description: string;
  isEncrypted: boolean;
}

export interface AirflowPool {
  name: string;
  slots: number;
  occupiedSlots: number;
  runningSlots: number;
  queuedSlots: number;
  openSlots: number;
  description: string;
}

export interface AirflowUser {
  username: string;
  name: string;
  email: string;
  active: boolean;
  roles: string;
}

export interface AirflowClient {
  dispose(): void;
  getVersion(signal?: AbortSignal): Promise<AirflowVersion>;
  listDags(signal?: AbortSignal): Promise<DagSummary[]>;
  getDag(dagId: string, signal?: AbortSignal): Promise<DagDetails>;
  getDagSource(dagId: string, signal?: AbortSignal): Promise<string>;
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
  setDagRunState(
    dagId: string,
    dagRunId: string,
    state: "failed",
    signal?: AbortSignal,
  ): Promise<DagRun>;
  clearTaskInstance(
    input: TaskInstanceRef,
    onlyFailed: boolean,
    signal?: AbortSignal,
  ): Promise<void>;
  listAssets(signal?: AbortSignal): Promise<Asset[]>;
  getAsset(assetId: number, signal?: AbortSignal): Promise<Asset>;
  listAssetEvents(assetId: number, signal?: AbortSignal): Promise<AssetEvent[]>;
  listConnections(signal?: AbortSignal): Promise<AirflowConnection[]>;
  createConnection(
    input: Omit<AirflowConnection, "port"> & {
      port?: number;
      password?: string;
      extra?: string;
    },
    signal?: AbortSignal,
  ): Promise<AirflowConnection>;
  deleteConnection(connectionId: string, signal?: AbortSignal): Promise<void>;
  listVariables(signal?: AbortSignal): Promise<AirflowVariable[]>;
  createVariable(
    input: { key: string; value: string; description?: string },
    signal?: AbortSignal,
  ): Promise<AirflowVariable>;
  deleteVariable(key: string, signal?: AbortSignal): Promise<void>;
  listPools(signal?: AbortSignal): Promise<AirflowPool[]>;
  createPool(
    input: { name: string; slots: number; description?: string },
    signal?: AbortSignal,
  ): Promise<AirflowPool>;
  deletePool(name: string, signal?: AbortSignal): Promise<void>;
  listUsers(signal?: AbortSignal): Promise<AirflowUser[]>;
  supportsUserAdministration(): boolean;
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
