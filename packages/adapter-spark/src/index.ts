import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

type Application = {
  id: string;
  name: string;
  completed?: boolean;
  sparkUser?: string;
  startTime?: string;
  endTime?: string;
  attempts?: Array<{ attemptId: string }>;
};
type Job = {
  jobId: number;
  name: string;
  status: string;
  numTasks?: number;
  numCompletedTasks?: number;
  submissionTime?: string;
};

const connectionSchema = z.object({
  url: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
});
const appInput = z.object({ appId: z.string().min(1) });
const pageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const sparkAdapter = defineAdapter({
  id: "spark",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "spark",
    name: "Spark",
    category: "Compute",
    description: "Inspect Spark applications, jobs, and stages.",
    icon: "spark",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "url",
      label: "History server URL",
      type: "url",
      required: true,
      placeholder: "http://spark-history:18080",
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
      id: "applications",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: {
        kind: "job-browser",
        title: "Applications",
        detail: "app-detail",
        idField: "id",
        columns: [
          { id: "name", label: "Application", format: "code" },
          { id: "sparkUser", label: "User", format: "text" },
          { id: "startTime", label: "Started", format: "timestamp" },
        ],
      },
    },
    {
      id: "app-detail",
      authorization: "inspect",
      view: {
        kind: "service-info",
        title: "Application",
        columns: [
          { id: "jobId", label: "Job", format: "number" },
          { id: "name", label: "Name", format: "code" },
          { id: "status", label: "Status", format: "status" },
          { id: "numTasks", label: "Tasks", format: "number" },
          { id: "numCompletedTasks", label: "Completed", format: "number" },
          { id: "submissionTime", label: "Submitted", format: "timestamp" },
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
    async function sparkGet<T>(path: string): Promise<T> {
      const response = await fetchFn(`${base}${path}`, {
        signal: context.signal,
        headers,
      });
      if (!response.ok)
        throw new Error(`Spark ${path} responded ${response.status}`);
      return (await response.json()) as T;
    }
    function overviewItems(applications: Application[]) {
      const completed = applications.filter((app) => app.completed).length;
      const active = applications.length - completed;
      return [
        { label: "Applications", value: applications.length },
        { label: "Active", value: active },
        { label: "Completed", value: completed },
      ];
    }
    return {
      async health() {
        const started = Date.now();
        try {
          const applications = await sparkGet<Application[]>(
            "/api/v1/applications",
          );
          return {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: `${applications.length} application(s)`,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to reach Spark history server",
          };
        }
      },
      async execute(operationId, input) {
        if (
          operationId === "service-info" ||
          operationId === "overview" ||
          operationId === "metrics"
        )
          return sparkGet<Application[]>("/api/v1/applications").then(
            (applications) => ({ items: overviewItems(applications) }),
          );
        if (operationId === "applications") {
          const { limit } = pageInput.parse(input);
          const applications = await sparkGet<Application[]>(
            "/api/v1/applications",
          );
          const items = applications.slice(0, limit).map((app) => ({
            id: app.id,
            name: app.name,
            completed: app.completed ?? false,
            sparkUser: app.sparkUser ?? "",
            startTime: app.startTime,
          }));
          return {
            items,
            nextCursor:
              applications.length > items.length ? "unsupported" : undefined,
          };
        }
        if (operationId === "app-detail") {
          const { appId } = appInput.parse(input);
          const app = await sparkGet<Application>(
            `/api/v1/applications/${appId}`,
          );
          const attemptId = app.attempts?.[0]?.attemptId;
          const jobsPath = attemptId
            ? `/api/v1/applications/${appId}/${attemptId}/jobs`
            : `/api/v1/applications/${appId}/jobs`;
          const jobs = await sparkGet<Job[]>(jobsPath);
          const items = jobs.map((job) => ({
            jobId: job.jobId,
            name: job.name,
            status: job.status,
            numTasks: job.numTasks ?? 0,
            numCompletedTasks: job.numCompletedTasks ?? 0,
            submissionTime: job.submissionTime,
          }));
          return { items };
        }
        throw new Error(`Unsupported Spark operation: ${operationId}`);
      },
    };
  },
});
export default sparkAdapter;
