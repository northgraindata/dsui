import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().optional(),
  tokenHeader: z.string().min(1).default("Authorization"),
});
type GraphqlResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

const queries: Record<string, string> = {
  "service-info": `query DsuiInstance { version }`,
  workspace: `query DsuiWorkspace { workspaceOrError { __typename ... on Workspace { locationEntries { id name loadStatus updatedTimestamp versionKey displayMetadata { key value } locationOrLoadError { __typename ... on RepositoryLocation { name repositories { name pipelines { name isJob graphName } schedules { name scheduleState { status } cronSchedule } sensors { name sensorState { status } sensorType } } } ... on PythonError { message stack } } } } ... on PythonError { message stack } } }`,
  jobs: `query DsuiJobs { workspaceOrError { __typename ... on Workspace { locationEntries { name locationOrLoadError { __typename ... on RepositoryLocation { repositories { name pipelines { id name isJob graphName description } } } } } } } }`,
  runs: `query DsuiRuns($limit: Int, $cursor: String) { runsOrError(limit: $limit, cursor: $cursor) { __typename ... on Runs { results { id runId jobName status mode startTime endTime updateTime tags { key value } } } ... on PythonError { message stack } } }`,
  assets: `query DsuiAssets($limit: Int, $cursor: String) { assetsOrError(limit: $limit, cursor: $cursor) { __typename ... on AssetConnection { nodes { id key { path } definition { description groupName computeKind isObservable isExecutable jobNames owners { __typename ... on UserAssetOwner { email } ... on TeamAssetOwner { team } } } } cursor } ... on PythonError { message stack } } }`,
  schedules: `query DsuiSchedules { workspaceOrError { __typename ... on Workspace { locationEntries { name locationOrLoadError { __typename ... on RepositoryLocation { repositories { name schedules { id name cronSchedule executionTimezone scheduleState { id status runningCount } pipelineName } } } } } } } }`,
  sensors: `query DsuiSensors { workspaceOrError { __typename ... on Workspace { locationEntries { name locationOrLoadError { __typename ... on RepositoryLocation { repositories { name sensors { id name sensorType targets { pipelineName mode } sensorState { id status runningCount } } } } } } } } }`,
  backfills: `query DsuiBackfills($limit: Int, $cursor: String) { partitionBackfillsOrError(limit: $limit, cursor: $cursor) { __typename ... on PartitionBackfills { results { backfillId status timestamp partitionNames jobName } } ... on PythonError { message stack } } }`,
  daemons: `query DsuiDaemons { instance { daemonHealth { id allDaemonStatuses { daemonType id healthy required lastHeartbeatTime lastHeartbeatErrors { message stack } } } } }`,
  resources: `query DsuiResources { workspaceOrError { __typename ... on Workspace { locationEntries { name locationOrLoadError { __typename ... on RepositoryLocation { repositories { name allTopLevelResourceDetails { name description resourceType } } } } } } } }`,
};

function flatten(
  operationId: string,
  data: Record<string, unknown>,
): unknown[] {
  if (operationId === "runs")
    return (
      ((data.runsOrError as Record<string, unknown> | undefined)
        ?.results as unknown[]) ?? []
    );
  if (operationId === "assets")
    return (
      ((data.assetsOrError as Record<string, unknown> | undefined)
        ?.nodes as unknown[]) ?? []
    );
  if (operationId === "backfills")
    return (
      ((data.partitionBackfillsOrError as Record<string, unknown> | undefined)
        ?.results as unknown[]) ?? []
    );
  if (operationId === "daemons")
    return (
      ((
        (data.instance as Record<string, unknown> | undefined)?.daemonHealth as
          | Record<string, unknown>
          | undefined
      )?.allDaemonStatuses as unknown[]) ?? []
    );
  return [data];
}

export const dagsterAdapter = defineAdapter({
  id: "dagster",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "dagster",
    name: "Dagster",
    category: "Orchestration",
    description:
      "Inspect and operate Dagster jobs, runs, assets, schedules, sensors, and backfills.",
    icon: "dagster",
    docsUrl: "https://docs.dagster.io/api/graphql",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "baseUrl",
      label: "Dagster webserver URL",
      type: "url",
      required: true,
      placeholder: "http://dagster-webserver:3000",
    },
    { id: "token", label: "Token", type: "password", secret: true },
    {
      id: "tokenHeader",
      label: "Token header",
      type: "text",
      placeholder: "Authorization",
    },
  ],
  secretPaths: ["token"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Instance" },
    },
    {
      id: "workspace",
      authorization: "inspect",
      view: { kind: "record-list", title: "Deployment" },
    },
    {
      id: "jobs",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Jobs" },
    },
    {
      id: "runs",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: { kind: "job-browser", title: "Runs" },
    },
    {
      id: "assets",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: { kind: "record-list", title: "Assets" },
    },
    {
      id: "schedules",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Schedules" },
    },
    {
      id: "sensors",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Sensors" },
    },
    {
      id: "backfills",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Backfills" },
    },
    {
      id: "daemons",
      authorization: "inspect",
      view: { kind: "service-info", title: "Daemons" },
    },
    {
      id: "resources",
      authorization: "inspect",
      view: { kind: "record-list", title: "Resources" },
    },
    {
      id: "graphql",
      authorization: "execute",
      view: { kind: "action-form", title: "GraphQL" },
    },
    {
      id: "launch-run",
      authorization: "execute",
      view: { kind: "action-form", title: "Launch run" },
    },
    {
      id: "terminate-run",
      authorization: "execute",
      view: { kind: "action-form", title: "Terminate run" },
    },
    {
      id: "schedule-state",
      authorization: "execute",
      view: { kind: "action-form", title: "Start or stop schedule" },
    },
    {
      id: "sensor-state",
      authorization: "execute",
      view: { kind: "action-form", title: "Start or stop sensor" },
    },
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const endpoint = `${connection.baseUrl.replace(/\/$/, "")}/graphql`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (connection.token)
      headers[connection.tokenHeader] =
        connection.tokenHeader.toLowerCase() === "authorization" &&
        !/^(Bearer|Basic) /i.test(connection.token)
          ? `Bearer ${connection.token}`
          : connection.token;
    async function graphql<T>(
      query: string,
      variables: Record<string, unknown> = {},
    ): Promise<T> {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers,
        signal: context.signal,
        body: JSON.stringify({ query, variables }),
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as GraphqlResponse<T>;
      if (!response.ok || body.errors?.length)
        throw new Error(
          body.errors
            ?.map((error) => error.message)
            .filter(Boolean)
            .join("; ") || `Dagster responded ${response.status}`,
        );
      if (!body.data) throw new Error("Dagster returned no GraphQL data");
      return body.data;
    }
    return {
      async health() {
        const started = Date.now();
        try {
          await graphql("query DsuiHealth { version }");
          return {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to query Dagster GraphQL",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId in queries) {
          const parsed = z
            .object({
              limit: z.coerce.number().int().min(1).max(100).default(50),
              cursor: z.string().optional(),
            })
            .parse(input);
          const data = await graphql<Record<string, unknown>>(
            queries[operationId] ?? "",
            parsed,
          );
          return { items: flatten(operationId, data) };
        }
        if (operationId === "graphql") {
          const parsed = z
            .object({
              query: z.string().min(1),
              variables: z.record(z.unknown()).default({}),
            })
            .parse(input);
          return graphql(parsed.query, parsed.variables);
        }
        if (operationId === "launch-run") {
          const parsed = z
            .object({
              repositoryLocationName: z.string(),
              repositoryName: z.string(),
              jobName: z.string(),
              runConfigData: z.record(z.unknown()).default({}),
              tags: z
                .array(z.object({ key: z.string(), value: z.string() }))
                .default([]),
            })
            .parse(input);
          return graphql(
            `mutation DsuiLaunch($executionParams: ExecutionParams!) { launchPipelineExecution(executionParams: $executionParams) { __typename ... on LaunchRunSuccess { run { runId status } } ... on PipelineNotFoundError { message } ... on RunConfigValidationInvalid { errors { message } } ... on PythonError { message stack } } }`,
            {
              executionParams: {
                selector: {
                  repositoryLocationName: parsed.repositoryLocationName,
                  repositoryName: parsed.repositoryName,
                  pipelineName: parsed.jobName,
                },
                runConfigData: parsed.runConfigData,
                mode: "default",
                executionMetadata: { tags: parsed.tags },
              },
            },
          );
        }
        if (operationId === "terminate-run") {
          const { runId } = z.object({ runId: z.string().min(1) }).parse(input);
          return graphql(
            `mutation DsuiTerminate($runId: String!) { terminateRun(runId: $runId) { __typename ... on TerminateRunSuccess { run { runId status } } ... on TerminateRunFailure { message } ... on RunNotFoundError { message } ... on PythonError { message stack } } }`,
            { runId },
          );
        }
        if (
          operationId === "schedule-state" ||
          operationId === "sensor-state"
        ) {
          const parsed = z
            .object({
              repositoryLocationName: z.string().min(1),
              repositoryName: z.string().min(1),
              name: z.string().min(1),
              running: z.boolean(),
            })
            .parse(input);
          const schedule = operationId === "schedule-state";
          const mutation = schedule
            ? parsed.running
              ? "startSchedule"
              : "stopRunningSchedule"
            : parsed.running
              ? "startSensor"
              : "stopSensor";
          const type = schedule ? "ScheduleSelector" : "SensorSelector";
          return graphql(
            `mutation DsuiState($selector: ${type}!) { ${mutation}(${schedule ? "scheduleSelector" : "sensorSelector"}: $selector) { __typename } }`,
            {
              selector: {
                repositoryLocationName: parsed.repositoryLocationName,
                repositoryName: parsed.repositoryName,
                ...(schedule
                  ? { scheduleName: parsed.name }
                  : { sensorName: parsed.name }),
              },
            },
          );
        }
        throw new Error(`Unsupported Dagster operation: ${operationId}`);
      },
    };
  },
});

export default dagsterAdapter;
