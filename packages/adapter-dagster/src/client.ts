import { Buffer } from "node:buffer";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type {
  DagsterAsset,
  DagsterConfig,
  DagsterEvent,
  DagsterJob,
  DagsterMaterialization,
  DagsterOp,
  DagsterRepository,
  DagsterRun,
  DagsterRunDetail,
  DagsterSchedule,
  DagsterSensor,
} from "./context.js";

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
/** Dagster's implicit job that can materialize any asset selection. */
const IMPLICIT_ASSET_JOB = "__ASSET_JOB";

const errorSchema = z.object({ message: z.string() });
const jobSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  isAssetJob: z.boolean(),
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
const assetKeySchema = z.object({ path: z.array(z.string()) });
const runDetailSchema = runSchema.extend({
  repositoryOrigin: z
    .object({
      repositoryName: z.string(),
      repositoryLocationName: z.string(),
    })
    .nullable(),
  stepKeysToExecute: z.array(z.string()).nullable(),
  stepStats: z.array(
    z.object({
      stepKey: z.string(),
      status: z.string().nullable(),
      startTime: z.number().nullable(),
      endTime: z.number().nullable(),
    }),
  ),
  assetMaterializations: z.array(
    z.object({ assetKey: assetKeySchema.nullable() }),
  ),
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
const checkSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  blocking: z.boolean(),
  executionForLatestMaterialization: z
    .object({
      status: z.string(),
      timestamp: z.number(),
      runId: z.string(),
      evaluation: z.object({ severity: z.string() }).nullable(),
    })
    .nullable(),
});
const assetSchema = z.object({
  assetKey: assetKeySchema,
  description: z.string().nullable(),
  groupName: z.string(),
  kinds: z.array(z.string()),
  tags: z.array(z.object({ key: z.string(), value: z.string() })),
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
  staleStatus: z.string().nullable(),
  // Older instances answer with a migration error instead of checks.
  assetChecksOrError: z.object({
    __typename: z.string(),
    checks: z.array(checkSchema).optional(),
  }),
  assetMaterializations: z.array(
    z.object({ timestamp: z.string(), runId: z.string() }),
  ),
});
const latestInfoSchema = z.object({
  assetKey: assetKeySchema,
  inProgressRunIds: z.array(z.string()),
  unstartedRunIds: z.array(z.string()),
  latestRun: z.object({ runId: z.string(), status: z.string() }).nullable(),
});
const tickSchema = z.object({ timestamp: z.number(), status: z.string() });
const scheduleSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  cronSchedule: z.string(),
  executionTimezone: z.string().nullable(),
  pipelineName: z.string(),
  scheduleState: z.object({
    id: z.string(),
    status: z.string(),
    ticks: z.array(tickSchema),
  }),
  futureTicks: z.object({
    results: z.array(z.object({ timestamp: z.number().nullable() })),
  }),
});
const sensorSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  sensorType: z.string(),
  minIntervalSeconds: z.number(),
  targets: z.array(z.object({ pipelineName: z.string() })).nullable(),
  sensorState: z.object({
    id: z.string(),
    status: z.string(),
    ticks: z.array(tickSchema.extend({ skipReason: z.string().nullable() })),
  }),
});
const automationSchema = z.object({
  name: z.string(),
  location: z.object({ name: z.string() }),
  schedules: z.array(scheduleSchema),
  sensors: z.array(sensorSchema),
});

const repositoriesQuery = `query Repositories {
  repositoriesOrError {
    __typename
    ... on RepositoryConnection {
      nodes { name location { name } jobs { name description isAssetJob } }
    }
    ... on PythonError { message }
  }
}`;
const assetsQuery = `query Assets {
  assetNodes {
    assetKey { path }
    description
    groupName
    kinds
    tags { key value }
    repository { name location { name } }
    jobNames
    owners { __typename ... on UserAssetOwner { email } ... on TeamAssetOwner { team } }
    dependencyKeys { path }
    dependedByKeys { path }
    isMaterializable
    isPartitioned
    staleStatus
    assetChecksOrError {
      __typename
      ... on AssetChecks {
        checks {
          name description blocking
          executionForLatestMaterialization {
            status timestamp runId evaluation { severity }
          }
        }
      }
    }
    assetMaterializations(limit: 1) { timestamp runId }
  }
}`;
const latestInfoQuery = `query AssetsLatestInfo($keys: [AssetKeyInput!]!) {
  assetsLatestInfo(assetKeys: $keys) {
    assetKey { path }
    inProgressRunIds
    unstartedRunIds
    latestRun { runId status }
  }
}`;
const historyQuery = `query AssetHistory($path: [String!]!) {
  assetOrError(assetKey: { path: $path }) {
    __typename
    ... on Asset { assetMaterializations(limit: 50) { timestamp runId stepKey } }
    ... on AssetNotFoundError { message }
  }
}`;
const automationQuery = `query Automation {
  repositoriesOrError {
    __typename
    ... on RepositoryConnection {
      nodes {
        name
        location { name }
        schedules {
          name description cronSchedule executionTimezone pipelineName
          scheduleState { id status ticks(limit: 1) { timestamp status } }
          futureTicks(limit: 1) { results { timestamp } }
        }
        sensors {
          name description sensorType minIntervalSeconds
          targets { pipelineName }
          sensorState { id status ticks(limit: 1) { timestamp status skipReason } }
        }
      }
    }
    ... on PythonError { message }
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
    ... on Run {
      runId jobName status startTime endTime
      repositoryOrigin { repositoryName repositoryLocationName }
      stepKeysToExecute
      stepStats { stepKey status startTime endTime }
      assetMaterializations { assetKey { path } }
    }
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
const launchQuery = `mutation Launch($selector: JobOrPipelineSelector!, $config: RunConfigData!) {
  launchRun(executionParams: { selector: $selector, runConfigData: $config }) {
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
const startScheduleQuery = `mutation StartSchedule($selector: ScheduleSelector!) {
  startSchedule(scheduleSelector: $selector) {
    __typename
    ... on PythonError { message }
    ... on UnauthorizedError { message }
    ... on ScheduleNotFoundError { message }
  }
}`;
const stopScheduleQuery = `mutation StopSchedule($id: String!) {
  stopRunningSchedule(id: $id) {
    __typename
    ... on PythonError { message }
    ... on UnauthorizedError { message }
    ... on ScheduleNotFoundError { message }
  }
}`;
const startSensorQuery = `mutation StartSensor($selector: SensorSelector!) {
  startSensor(sensorSelector: $selector) {
    __typename
    ... on PythonError { message }
    ... on UnauthorizedError { message }
    ... on SensorNotFoundError { message }
  }
}`;
const stopSensorQuery = `mutation StopSensor($id: String!) {
  stopSensor(id: $id) {
    __typename
    ... on PythonError { message }
    ... on UnauthorizedError { message }
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

/** Stable, URL-safe id for an asset key path. */
export function assetIdFor(path: readonly string[]): string {
  return Buffer.from(JSON.stringify(path)).toString("base64url");
}

/** Dagster's own synthetic jobs, which its UI hides as well. */
function isHiddenJob(name: string): boolean {
  return name.startsWith("__");
}

type JobSelector = Pick<
  DagsterJob,
  "name" | "repositoryName" | "repositoryLocationName"
>;
type NamedSelector = DagsterRepository & { name: string };

export interface DagsterClient {
  listAssets(signal?: AbortSignal): Promise<DagsterAsset[]>;
  getAssetHistory(
    path: readonly string[],
    signal?: AbortSignal,
  ): Promise<DagsterMaterialization[]>;
  listJobs(signal?: AbortSignal): Promise<DagsterJob[]>;
  listSchedules(signal?: AbortSignal): Promise<DagsterSchedule[]>;
  listSensors(signal?: AbortSignal): Promise<DagsterSensor[]>;
  listRuns(signal?: AbortSignal): Promise<DagsterRun[]>;
  getRun(runId: string, signal?: AbortSignal): Promise<DagsterRunDetail>;
  getRunLogs(runId: string, signal?: AbortSignal): Promise<DagsterEvent[]>;
  getJobOps(job: JobSelector, signal?: AbortSignal): Promise<DagsterOp[]>;
  launchJob(job: JobSelector, signal?: AbortSignal): Promise<string>;
  materializeAssets(
    repository: DagsterRepository,
    paths: readonly (readonly string[])[],
    signal?: AbortSignal,
  ): Promise<string>;
  terminateRun(runId: string, signal?: AbortSignal): Promise<void>;
  setScheduleRunning(
    schedule: NamedSelector & { stateId: string },
    running: boolean,
    signal?: AbortSignal,
  ): Promise<void>;
  setSensorRunning(
    sensor: NamedSelector & { stateId: string },
    running: boolean,
    signal?: AbortSignal,
  ): Promise<void>;
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

async function getRun(
  query: Query,
  runId: string,
  signal?: AbortSignal,
): Promise<DagsterRunDetail> {
  const run = runDetailSchema.parse(
    requireType((await query(runQuery, { runId }, signal)).runOrError, "Run"),
  );
  return {
    runId: run.runId,
    jobName: run.jobName,
    status: run.status,
    startTime: run.startTime,
    endTime: run.endTime,
    repositoryName: run.repositoryOrigin?.repositoryName ?? "",
    repositoryLocationName: run.repositoryOrigin?.repositoryLocationName ?? "",
    plannedStepKeys: run.stepKeysToExecute,
    steps: run.stepStats,
    materializedAssetIds: [
      ...new Set(
        run.assetMaterializations.flatMap((event) =>
          event.assetKey ? [assetIdFor(event.assetKey.path)] : [],
        ),
      ),
    ],
  };
}

async function getJobOps(
  query: Query,
  job: JobSelector,
  signal?: AbortSignal,
): Promise<DagsterOp[]> {
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
      dependsOn: [
        ...new Set(
          handle.solid.inputs.flatMap((input) =>
            input.dependsOn.map((dependency) => dependency.solid.name),
          ),
        ),
      ],
      isDynamicMapped: handle.solid.isDynamicMapped,
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
  const nodes = z.array(assetSchema).parse(data.assetNodes);
  const latest = nodes.length
    ? z
        .array(latestInfoSchema)
        .parse(
          (
            await query(
              latestInfoQuery,
              { keys: nodes.map((node) => ({ path: node.assetKey.path })) },
              signal,
            )
          ).assetsLatestInfo,
        )
    : [];
  const latestById = new Map(
    latest.map((info) => [assetIdFor(info.assetKey.path), info]),
  );
  return nodes.map((asset) => {
    const id = assetIdFor(asset.assetKey.path);
    const info = latestById.get(id);
    return {
      id,
      name: asset.assetKey.path.join("/"),
      path: asset.assetKey.path,
      description: asset.description ?? "",
      group: asset.groupName,
      kinds: asset.kinds,
      tags: asset.tags.map((tag) =>
        tag.value ? `${tag.key}=${tag.value}` : tag.key,
      ),
      repositoryName: asset.repository.name,
      repositoryLocationName: asset.repository.location.name,
      jobNames: asset.jobNames.filter((name) => !isHiddenJob(name)),
      owners: asset.owners.map((owner) =>
        owner.__typename === "UserAssetOwner" ? owner.email : owner.team,
      ),
      upstreamIds: asset.dependencyKeys.map((key) => assetIdFor(key.path)),
      downstreamIds: asset.dependedByKeys.map((key) => assetIdFor(key.path)),
      isMaterializable: asset.isMaterializable,
      isPartitioned: asset.isPartitioned,
      staleStatus: asset.staleStatus,
      checks: (asset.assetChecksOrError.checks ?? []).map((check) => {
        const execution = check.executionForLatestMaterialization;
        return {
          name: check.name,
          description: check.description ?? "",
          blocking: check.blocking,
          status: execution?.status ?? null,
          severity: execution?.evaluation?.severity ?? null,
          timestamp: execution?.timestamp ?? null,
          runId: execution?.runId ?? null,
        };
      }),
      latestMaterialization: asset.assetMaterializations[0]?.timestamp ?? null,
      latestRunId: asset.assetMaterializations[0]?.runId ?? null,
      latestRun: info?.latestRun ?? null,
      inProgress:
        !!info &&
        info.inProgressRunIds.length + info.unstartedRunIds.length > 0,
    };
  });
}

async function listAutomation(query: Query, signal?: AbortSignal) {
  const result = requireType(
    (await query(automationQuery, {}, signal)).repositoriesOrError,
    "RepositoryConnection",
  );
  return z.array(automationSchema).parse(result.nodes);
}

async function launch(
  query: Query,
  selector: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const result = (await query(launchQuery, { selector, config: {} }, signal))
    .launchRun;
  const parsed = z
    .object({
      __typename: z.string(),
      errors: z.array(errorSchema).optional(),
    })
    .safeParse(result);
  if (parsed.success && parsed.data.errors?.length)
    throw graphqlError(parsed.data.errors[0]);
  const success = requireType(result, "LaunchRunSuccess");
  return z.object({ runId: z.string() }).parse(success.run).runId;
}

/** Mutation unions report success as a result type and failure as an error. */
function requireMutation(value: unknown, success: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Dagster GraphQL response");
  const typename = (value as Record<string, unknown>).__typename;
  if (typename !== success) throw graphqlError(value);
}

export function createDagsterClient(config: DagsterConfig): DagsterClient {
  const query = createQuery(endpointFor(config), headersFor(config));

  return {
    listAssets: (signal) => listAssets(query, signal),
    getAssetHistory: async (path, signal) => {
      const result = requireType(
        (await query(historyQuery, { path }, signal)).assetOrError,
        "Asset",
      );
      return z
        .array(
          z.object({
            timestamp: z.string(),
            runId: z.string(),
            stepKey: z.string().nullable(),
          }),
        )
        .parse(result.assetMaterializations)
        .map((event) => ({ ...event, stepKey: event.stepKey ?? "" }));
    },
    listJobs: async (signal) => {
      const result = requireType(
        (await query(repositoriesQuery, {}, signal)).repositoriesOrError,
        "RepositoryConnection",
      );
      const repositories = z.array(repositorySchema).parse(result.nodes);
      return repositories.flatMap((repository) =>
        repository.jobs
          .filter((job) => !isHiddenJob(job.name))
          .map((job) => ({
            name: job.name,
            description: job.description ?? "",
            isAssetJob: job.isAssetJob,
            repositoryName: repository.name,
            repositoryLocationName: repository.location.name,
          })),
      );
    },
    listSchedules: async (signal) =>
      (await listAutomation(query, signal)).flatMap((repository) =>
        repository.schedules.map((schedule) => ({
          name: schedule.name,
          description: schedule.description ?? "",
          cronSchedule: schedule.cronSchedule,
          timezone: schedule.executionTimezone ?? "UTC",
          jobName: schedule.pipelineName,
          status: schedule.scheduleState.status,
          stateId: schedule.scheduleState.id,
          lastTick: schedule.scheduleState.ticks[0] ?? null,
          nextTick: schedule.futureTicks.results[0]?.timestamp ?? null,
          repositoryName: repository.name,
          repositoryLocationName: repository.location.name,
        })),
      ),
    listSensors: async (signal) =>
      (await listAutomation(query, signal)).flatMap((repository) =>
        repository.sensors.map((sensor) => {
          const tick = sensor.sensorState.ticks[0];
          return {
            name: sensor.name,
            description: sensor.description ?? "",
            sensorType: sensor.sensorType,
            minIntervalSeconds: sensor.minIntervalSeconds,
            jobNames: (sensor.targets ?? []).map(
              (target) => target.pipelineName,
            ),
            status: sensor.sensorState.status,
            stateId: sensor.sensorState.id,
            lastTick: tick
              ? {
                  timestamp: tick.timestamp,
                  status: tick.status,
                  skipReason: tick.skipReason ?? "",
                }
              : null,
            repositoryName: repository.name,
            repositoryLocationName: repository.location.name,
          };
        }),
      ),
    listRuns: (signal) => listRuns(query, signal),
    getRun: (runId, signal) => getRun(query, runId, signal),
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
    getJobOps: (job, signal) => getJobOps(query, job, signal),
    launchJob: (job, signal) =>
      launch(
        query,
        {
          repositoryLocationName: job.repositoryLocationName,
          repositoryName: job.repositoryName,
          jobName: job.name,
        },
        signal,
      ),
    materializeAssets: (repository, paths, signal) =>
      launch(
        query,
        {
          repositoryLocationName: repository.repositoryLocationName,
          repositoryName: repository.repositoryName,
          jobName: IMPLICIT_ASSET_JOB,
          assetSelection: paths.map((path) => ({ path })),
        },
        signal,
      ),
    terminateRun: async (runId, signal) => {
      requireType(
        (await query(terminateQuery, { runId }, signal)).terminateRun,
        "TerminateRunSuccess",
      );
    },
    setScheduleRunning: async (schedule, running, signal) => {
      const data = running
        ? await query(
            startScheduleQuery,
            {
              selector: {
                repositoryLocationName: schedule.repositoryLocationName,
                repositoryName: schedule.repositoryName,
                scheduleName: schedule.name,
              },
            },
            signal,
          )
        : await query(stopScheduleQuery, { id: schedule.stateId }, signal);
      requireMutation(
        running ? data.startSchedule : data.stopRunningSchedule,
        "ScheduleStateResult",
      );
    },
    setSensorRunning: async (sensor, running, signal) => {
      if (running) {
        const data = await query(
          startSensorQuery,
          {
            selector: {
              repositoryLocationName: sensor.repositoryLocationName,
              repositoryName: sensor.repositoryName,
              sensorName: sensor.name,
            },
          },
          signal,
        );
        requireMutation(data.startSensor, "Sensor");
        return;
      }
      const data = await query(stopSensorQuery, { id: sensor.stateId }, signal);
      requireMutation(data.stopSensor, "StopSensorMutationResult");
    },
  };
}
