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

export interface DagsterJob {
  name: string;
  description: string;
  repositoryName: string;
  repositoryLocationName: string;
}

export interface DagsterRun {
  runId: string;
  jobName: string;
  status: string;
  startTime: number | null;
  endTime: number | null;
}

export interface DagsterEvent {
  timestamp: string;
  message: string;
  level: string;
  stepKey: string;
}

export interface DagsterStep {
  name: string;
  upstream: string;
  kind: string;
}

export interface DagsterAsset {
  id: string;
  name: string;
  path: string[];
  description: string;
  group: string;
  repositoryName: string;
  repositoryLocationName: string;
  jobNames: string[];
  owners: string[];
  upstreamIds: string[];
  downstreamIds: string[];
  isMaterializable: boolean;
  isPartitioned: boolean;
  hasAssetChecks: boolean;
  latestMaterialization: string | null;
  latestRunId: string | null;
}
