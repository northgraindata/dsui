import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

type Overview = {
  taskmanagers?: number;
  "slots-total"?: number;
  "slots-available"?: number;
  "jobs-running"?: number;
  "jobs-finished"?: number;
  "jobs-failed"?: number;
};
type JobSummary = {
  jid: string;
  name: string;
  state: string;
  "start-time"?: number;
  duration?: number;
};
type Vertex = {
  name: string;
  status: string;
  parallelism?: number;
  tasks?: Record<string, number>;
};
type JobDetail = {
  jid: string;
  name: string;
  state: string;
  vertices?: Vertex[];
};

const connectionSchema = z.object({
  url: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
});
const jobInput = z.object({ jobId: z.string().min(1) });
const pageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const flinkAdapter = defineAdapter({
  id: "flink",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "flink",
    name: "Flink",
    category: "Streaming",
    description: "Inspect Flink clusters, jobs, and task managers.",
    icon: "flink",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "url",
      label: "JobManager URL",
      type: "url",
      required: true,
      placeholder: "http://flink-jobmanager:8081",
    },
    { id: "username", label: "Username", type: "text" },
    { id: "password", label: "Password", type: "password", secret: true },
  ],
  secretPaths: ["password"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Cluster" },
    },
    {
      id: "overview",
      authorization: "inspect",
      view: { kind: "service-info", title: "Overview" },
    },
    {
      id: "metrics",
      authorization: "inspect",
      view: { kind: "service-info", title: "Metrics" },
    },
    {
      id: "jobs",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: {
        kind: "job-browser",
        title: "Jobs",
        detail: "job-detail",
        idField: "id",
        columns: [
          { id: "name", label: "Job", format: "code" },
          { id: "state", label: "State", format: "status" },
          { id: "duration", label: "Duration", format: "number" },
        ],
      },
    },
    {
      id: "job-detail",
      authorization: "inspect",
      view: {
        kind: "service-info",
        title: "Job",
        columns: [
          { id: "name", label: "Vertex", format: "code" },
          { id: "status", label: "Status", format: "status" },
          { id: "parallelism", label: "Parallelism", format: "number" },
          { id: "tasksTotal", label: "Tasks", format: "number" },
          { id: "tasksRunning", label: "Running", format: "number" },
          { id: "tasksFinished", label: "Finished", format: "number" },
        ],
      },
    },
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const base = connection.url.replace(/\/$/, "");
    const headers: Record<string, string> = {};
    if (connection.username && connection.password) {
      const token = Buffer.from(
        `${connection.username}:${connection.password}`,
      ).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }
    async function flinkGet<T>(path: string): Promise<T> {
      const response = await fetchFn(`${base}${path}`, {
        signal: context.signal,
        headers,
      });
      if (!response.ok)
        throw new Error(`Flink ${path} responded ${response.status}`);
      return (await response.json()) as T;
    }
    function overviewItems(overview: Overview) {
      return [
        { label: "Task managers", value: overview.taskmanagers ?? 0 },
        { label: "Slots total", value: overview["slots-total"] ?? 0 },
        { label: "Slots available", value: overview["slots-available"] ?? 0 },
        { label: "Jobs running", value: overview["jobs-running"] ?? 0 },
        { label: "Jobs finished", value: overview["jobs-finished"] ?? 0 },
        { label: "Jobs failed", value: overview["jobs-failed"] ?? 0 },
      ];
    }
    return {
      async health() {
        const started = Date.now();
        try {
          const overview = await flinkGet<Overview>("/overview");
          return {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: `${overview.taskmanagers ?? 0} task manager(s), ${
              overview["jobs-running"] ?? 0
            } running`,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to reach Flink JobManager",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "service-info")
          return flinkGet<Overview>("/overview").then((overview) => ({
            items: overviewItems(overview),
          }));
        if (operationId === "overview" || operationId === "metrics")
          return flinkGet<Overview>("/overview").then((overview) => ({
            items: overviewItems(overview),
          }));
        if (operationId === "jobs") {
          const { limit } = pageInput.parse(input);
          const jobs = await flinkGet<JobSummary[]>("/jobs/overview");
          const items = jobs.slice(0, limit).map((job) => ({
            id: job.jid,
            name: job.name,
            state: job.state,
            duration: job.duration ?? 0,
            startTime: job["start-time"],
          }));
          return {
            items,
            nextCursor: jobs.length > items.length ? "unsupported" : undefined,
          };
        }
        if (operationId === "job-detail") {
          const { jobId } = jobInput.parse(input);
          const detail = await flinkGet<JobDetail>(`/jobs/${jobId}`);
          const items = (detail.vertices ?? []).map((vertex) => ({
            name: vertex.name,
            status: vertex.status,
            parallelism: vertex.parallelism ?? 0,
            tasksTotal: vertex.tasks?.total ?? 0,
            tasksRunning: vertex.tasks?.RUNNING ?? 0,
            tasksFinished: vertex.tasks?.FINISHED ?? 0,
          }));
          return { items };
        }
        throw new Error(`Unsupported Flink operation: ${operationId}`);
      },
    };
  },
});
export default flinkAdapter;
