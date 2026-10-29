import { Buffer } from "node:buffer";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type {
  DagsterAsset,
  DagsterConfig,
  DagsterEvent,
  DagsterJob,
  DagsterRun,
  DagsterStep,
} from "./context.js";

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const errorSchema = z.object({ message: z.string() });
const jobSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
});
const repositorySchema = z.object({
  name: z.string(),
  location: z.object({ name: z.string() }),
  jobs: z.array(jobSchema),
});
const runSchema = z.object({
  runId: z.string(),
  jobName: z.string(),
  status: z.string(),
  startTime: z.number().nullable(),
  endTime: z.number().nullable(),
});
const eventSchema = z.object({
  timestamp: z.string(),
  message: z.string(),
  level: z.string(),
  stepKey: z.string().nullable().optional(),
});
const handleSchema = z.object({
  handleID: z.string(),
  solid: z.object({
    name: z.string(),
    isDynamicMapped: z.boolean(),
    inputs: z.array(
      z.object({
        dependsOn: z.array(z.object({ solid: z.object({ name: z.string() }) })),
      }),
    ),
  }),
});
const assetKeySchema = z.object({ path: z.array(z.string()) });
const assetSchema = z.object({
  assetKey: assetKeySchema,
  description: z.string().nullable(),
  groupName: z.string(),
  repository: z.object({
    name: z.string(),
    location: z.object({ name: z.string() }),
  }),
  jobNames: z.array(z.string()),
  owners: z.array(
    z.discriminatedUnion("__typename", [
      z.object({ __typename: z.literal("UserAssetOwner"), email: z.string() }),
      z.object({ __typename: z.literal("TeamAssetOwner"), team: z.string() }),
    ]),
  ),
  dependencyKeys: z.array(assetKeySchema),
  dependedByKeys: z.array(assetKeySchema),
  isMaterializable: z.boolean(),
  isPartitioned: z.boolean(),
  hasAssetChecks: z.boolean(),
  assetMaterializations: z.array(
    z.object({ timestamp: z.string(), runId: z.string() }),
  ),
});

const repositoriesQuery = `query Repositories {
  repositoriesOrError {
    __typename
    ... on RepositoryConnection {
      nodes { name location { name } jobs { name description } }
    }
    ... on PythonError { message }
  }
}`;
const assetsQuery = `query Assets {
  assetNodes {
    assetKey { path }
    description
    groupName
    repository { name location { name } }
    jobNames
    owners { __typename ... on UserAssetOwner { email } ... on TeamAssetOwner { team } }
    dependencyKeys { path }
    dependedByKeys { path }
    isMaterializable
    isPartitioned
    hasAssetChecks
    assetMaterializations(limit: 1) { timestamp runId }
  }
}`;
const runsQuery = `query Runs($cursor: String) {
  runsOrError(cursor: $cursor, limit: 100) {
    __typename
    ... on Runs {
      results { runId jobName status startTime endTime }
    }
    ... on PythonError { message }
  }
}`;
const runQuery = `query Run($runId: ID!) {
  runOrError(runId: $runId) {
    __typename
    ... on Run { runId jobName status startTime endTime }
    ... on PythonError { message }
  }
}`;
const graphQuery = `query JobGraph($location: String!, $repository: String!, $job: String!) {
  pipelineOrError(params: {
    repositoryLocationName: $location, repositoryName: $repository, pipelineName: $job
  }) {
    __typename
    ... on Pipeline {
      solidHandles {
        handleID
        solid { name isDynamicMapped inputs { dependsOn { solid { name } } } }
      }
    }
    ... on PythonError { message }
  }
}`;
const logsQuery = `query RunLogs($runId: ID!) {
  logsForRun(runId: $runId) {
    __typename
    ... on EventConnection {
      events { ... on MessageEvent { timestamp message level stepKey } }
    }
    ... on PythonError { message }
  }
}`;
const launchQuery = `mutation Launch($location: String!, $repository: String!, $job: String!, $config: RunConfigData!) {
  launchRun(executionParams: {
    selector: { repositoryLocationName: $location, repositoryName: $repository, jobName: $job }
    runConfigData: $config
  }) {
    __typename
    ... on LaunchRunSuccess { run { runId } }
    ... on RunConfigValidationInvalid { errors { message } }
    ... on PythonError { message }
  }
}`;
const terminateQuery = `mutation Terminate($runId: String!) {
  terminateRun(runId: $runId) {
    __typename
    ... on TerminateRunSuccess { run { runId } }
    ... on TerminateRunFailure { message }
    ... on RunNotFoundError { runId }
    ... on PythonError { message }
  }
}`;

function graphqlError(value: unknown): Error {
  const parsed = errorSchema.safeParse(value);
  return new Error(
    parsed.success ? parsed.data.message : "Dagster returned an error",
  );
}

function requireType(value: unknown, type: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Dagster GraphQL response");
  const record = value as Record<string, unknown>;
  if (record.__typename !== type) throw graphqlError(value);
  return record;
}

function mapRun(value: unknown): DagsterRun {
  return runSchema.parse(value);
}

export interface DagsterClient {
  listAssets(signal?: AbortSignal): Promise<DagsterAsset[]>;
  listJobs(signal?: AbortSignal): Promise<DagsterJob[]>;
  listRuns(signal?: AbortSignal): Promise<DagsterRun[]>;
  getRun(runId: string, signal?: AbortSignal): Promise<DagsterRun>;
  getRunLogs(runId: string, signal?: AbortSignal): Promise<DagsterEvent[]>;
  getJobSteps(
    job: Pick<DagsterJob, "name" | "repositoryName" | "repositoryLocationName">,
    signal?: AbortSignal,
  ): Promise<DagsterStep[]>;
  launchJob(
    job: Pick<DagsterJob, "name" | "repositoryName" | "repositoryLocationName">,
    signal?: AbortSignal,
  ): Promise<string>;
  terminateRun(runId: string, signal?: AbortSignal): Promise<void>;
}

function createQuery(endpoint: URL, authHeaders: Record<string, string>) {
  return async function query(
    document: string,
    variables: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ query: document, variables }),
      signal,
    });
    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_BYTES)
      throw new Error("Dagster response exceeded the size limit");
    const envelope = z
      .object({
        data: z.record(z.string(), z.unknown()).nullable().optional(),
        errors: z.array(errorSchema).optional(),
      })
      .parse(JSON.parse(raw));
    if (envelope.errors?.length) throw graphqlError(envelope.errors[0]);
    if (!response.ok) throw new Error(`Dagster HTTP ${response.status}`);
    if (!envelope.data) throw new Error("Dagster GraphQL returned no data");
    return envelope.data;
  };
}

type Query = ReturnType<typeof createQuery>;

async function listRuns(
  query: Query,
  signal?: AbortSignal,
): Promise<DagsterRun[]> {
  const runs: DagsterRun[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const result = requireType(
      (await query(runsQuery, { cursor }, signal)).runsOrError,
      "Runs",
    );
    const batch = z.array(runSchema).parse(result.results);
    runs.push(...batch);
    if (batch.length < 100) break;
    cursor = batch[batch.length - 1]?.runId;
  }
  return runs;
}

async function getJobSteps(
  query: Query,
  job: Pick<DagsterJob, "name" | "repositoryName" | "repositoryLocationName">,
  signal?: AbortSignal,
): Promise<DagsterStep[]> {
  const result = requireType(
    (
      await query(
        graphQuery,
        {
          location: job.repositoryLocationName,
          repository: job.repositoryName,
          job: job.name,
        },
        signal,
      )
    ).pipelineOrError,
    "Pipeline",
  );
  return z
    .array(handleSchema)
    .parse(result.solidHandles)
    .filter((handle) => !handle.handleID.includes("."))
    .map((handle) => ({
      name: handle.solid.name,
      upstream:
        [
          ...new Set(
            handle.solid.inputs.flatMap((input) =>
              input.dependsOn.map((dependency) => dependency.solid.name),
            ),
          ),
        ].join(", ") || "—",
      kind: handle.solid.isDynamicMapped ? "Mapped op" : "Op",
    }));
}

function endpointFor(config: DagsterConfig): URL {
  const baseUrl = new URL(config.baseUrl);
  if (!["http:", "https:"].includes(baseUrl.protocol))
    throw new Error("Dagster URL must use HTTP or HTTPS");
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash)
    throw new Error(
      "Dagster URL cannot contain credentials or query parameters",
    );
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    baseUrl.hostname,
  );
  if (config.method !== "dagster" && baseUrl.protocol !== "https:" && !loopback)
    throw new Error("Authenticated Dagster connections require HTTPS");
  return new URL(`${baseUrl.pathname.replace(/\/$/, "")}/graphql`, baseUrl);
}

function headersFor(config: DagsterConfig): Record<string, string> {
  if (config.method === "dagster-basic")
    return {
      authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
    };
  if (config.method === "dagster-plus")
    return { "Dagster-Cloud-Api-Token": config.apiToken };
  return {};
}

async function listAssets(
  query: Query,
  signal?: AbortSignal,
): Promise<DagsterAsset[]> {
  const data = await query(assetsQuery, {}, signal);
  return z
    .array(assetSchema)
    .parse(data.assetNodes)
    .map((asset) => ({
      id: Buffer.from(JSON.stringify(asset.assetKey.path)).toString(
        "base64url",
      ),
      name: asset.assetKey.path.join("/"),
      path: asset.assetKey.path,
      description: asset.description ?? "",
      group: asset.groupName,
      repositoryName: asset.repository.name,
      repositoryLocationName: asset.repository.location.name,
      jobNames: asset.jobNames,
      owners: asset.owners.map((owner) =>
        owner.__typename === "UserAssetOwner" ? owner.email : owner.team,
      ),
      upstreamIds: asset.dependencyKeys.map((key) =>
        Buffer.from(JSON.stringify(key.path)).toString("base64url"),
      ),
      downstreamIds: asset.dependedByKeys.map((key) =>
        Buffer.from(JSON.stringify(key.path)).toString("base64url"),
      ),
      isMaterializable: asset.isMaterializable,
      isPartitioned: asset.isPartitioned,
      hasAssetChecks: asset.hasAssetChecks,
      latestMaterialization: asset.assetMaterializations[0]?.timestamp ?? null,
      latestRunId: asset.assetMaterializations[0]?.runId ?? null,
    }));
}

export function createDagsterClient(config: DagsterConfig): DagsterClient {
  const query = createQuery(endpointFor(config), headersFor(config));

  return {
    listAssets: (signal) => listAssets(query, signal),
    listJobs: async (signal) => {
      const result = requireType(
        (await query(repositoriesQuery, {}, signal)).repositoriesOrError,
        "RepositoryConnection",
      );
      const repositories = z.array(repositorySchema).parse(result.nodes);
      return repositories.flatMap((repository) =>
        repository.jobs.map((job) => ({
          name: job.name,
          description: job.description ?? "",
          repositoryName: repository.name,
          repositoryLocationName: repository.location.name,
        })),
      );
    },
    listRuns: (signal) => listRuns(query, signal),
    getRun: async (runId, signal) =>
      mapRun(
        requireType(
          (await query(runQuery, { runId }, signal)).runOrError,
          "Run",
        ),
      ),
    getRunLogs: async (runId, signal) => {
      const result = requireType(
        (await query(logsQuery, { runId }, signal)).logsForRun,
        "EventConnection",
      );
      return z
        .array(eventSchema)
        .parse(result.events)
        .map((event) => ({
          timestamp: event.timestamp,
          message: event.message,
          level: event.level,
          stepKey: event.stepKey ?? "",
        }));
    },
    getJobSteps: (job, signal) => getJobSteps(query, job, signal),
    launchJob: async (job, signal) => {
      const result = requireType(
        (
          await query(
            launchQuery,
            {
              location: job.repositoryLocationName,
              repository: job.repositoryName,
              job: job.name,
              config: {},
            },
            signal,
          )
        ).launchRun,
        "LaunchRunSuccess",
      );
      return z.object({ runId: z.string() }).parse(result.run).runId;
    },
    terminateRun: async (runId, signal) => {
      requireType(
        (await query(terminateQuery, { runId }, signal)).terminateRun,
        "TerminateRunSuccess",
      );
    },
  };
}
