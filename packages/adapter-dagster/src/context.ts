import { z } from "@northgraindata/dsui-adapter-sdk";
import type { DagsterClient } from "./client.js";

export const dagsterConnectionSchema = z.object({
  baseUrl: z.string().url(),
});

export const dagsterBasicConnectionSchema = dagsterConnectionSchema.extend({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const dagsterPlusConnectionSchema = dagsterConnectionSchema.extend({
  apiToken: z.string().min(1),
});

export type DagsterConfig =
  | ({ method: "dagster" } & z.output<typeof dagsterConnectionSchema>)
  | ({ method: "dagster-basic" } & z.output<
      typeof dagsterBasicConnectionSchema
    >)
  | ({ method: "dagster-plus" } & z.output<typeof dagsterPlusConnectionSchema>);

export interface DagsterContext {
  client: DagsterClient;
}

export interface DagsterRepository {
  repositoryName: string;
  repositoryLocationName: string;
}

export interface DagsterJob extends DagsterRepository {
  name: string;
  description: string;
  isAssetJob: boolean;
}

export interface DagsterRun {
  runId: string;
  jobName: string;
  status: string;
  startTime: number | null;
  endTime: number | null;
}

export interface DagsterRunStep {
  stepKey: string;
  status: string | null;
  startTime: number | null;
  endTime: number | null;
}

export interface DagsterRunDetail extends DagsterRun, DagsterRepository {
  /** Steps the run will execute, or null when it executes the whole job. */
  plannedStepKeys: string[] | null;
  steps: DagsterRunStep[];
  materializedAssetIds: string[];
}

export interface DagsterEvent {
  timestamp: string;
  message: string;
  level: string;
  stepKey: string;
}

export interface DagsterOp {
  name: string;
  dependsOn: string[];
  isDynamicMapped: boolean;
}

export interface DagsterAssetCheck {
  name: string;
  description: string;
  blocking: boolean;
  /** Resolved status of the latest execution, or null when it never ran. */
  status: string | null;
  severity: string | null;
  timestamp: number | null;
  runId: string | null;
}

export interface DagsterAsset extends DagsterRepository {
  id: string;
  name: string;
  path: string[];
  description: string;
  group: string;
  kinds: string[];
  tags: string[];
  jobNames: string[];
  owners: string[];
  upstreamIds: string[];
  downstreamIds: string[];
  isMaterializable: boolean;
  isPartitioned: boolean;
  staleStatus: string | null;
  checks: DagsterAssetCheck[];
  latestMaterialization: string | null;
  latestRunId: string | null;
  /** Latest run that targeted the asset, which may not have materialized it. */
  latestRun: { runId: string; status: string } | null;
  inProgress: boolean;
}

export interface DagsterMaterialization {
  timestamp: string;
  runId: string;
  stepKey: string;
}

interface DagsterTick {
  timestamp: number;
  status: string;
}

export interface DagsterSchedule extends DagsterRepository {
  name: string;
  description: string;
  cronSchedule: string;
  timezone: string;
  jobName: string;
  status: string;
  stateId: string;
  lastTick: DagsterTick | null;
  nextTick: number | null;
}

export interface DagsterSensor extends DagsterRepository {
  name: string;
  description: string;
  sensorType: string;
  minIntervalSeconds: number;
  jobNames: string[];
  status: string;
  stateId: string;
  lastTick: (DagsterTick & { skipReason: string }) | null;
}
