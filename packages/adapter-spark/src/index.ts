import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

type HistoryApplication = {
  id: string;
  name: string;
  completed?: boolean;
  sparkUser?: string;
  startTime?: string;
  attempts?: Array<{
    attemptId: string;
    startTime?: string;
    endTime?: string;
    completed?: boolean;
    sparkUser?: string;
  }>;
};

type MasterApplication = {
  id: string;
  name: string;
  user: string;
  cores: number;
  memory: string;
  submitDate: number;
  state: string;
  duration: number;
};

type MasterState = {
  status: string;
  url: string;
  workers: Array<{ id: string; host: string; state: string }>;
  cores: number;
  memory: string;
  activeapps: MasterApplication[];
  completedapps: MasterApplication[];
};

const connectionSchema = z.object({
  url: z.string().url(),
  mode: z.enum(["history", "master"]).default("history"),
  username: z.string().optional(),
  password: z.string().optional(),
});
const appInput = z
  .object({ id: z.string().optional(), appId: z.string().optional() })
  .refine(
    (value) => Boolean(value.id ?? value.appId),
    "Application id is required",
  );
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
    description:
      "Inspect Spark applications on a History Server or standalone Master.",
    icon: "spark",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "url",
      label: "Server URL",
      type: "url",
      required: true,
      placeholder: "http://spark-master:8080",
    },
    {
      id: "mode",
      label: "Mode",
      type: "select",
      placeholder: "history",
      options: [
        { label: "History server", value: "history" },
        { label: "Standalone master", value: "master" },
      ],
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
          { id: "name", label: "Name", format: "code" },
          { id: "status", label: "Status", format: "status" },
          { id: "user", label: "User", format: "text" },
          { id: "startTime", label: "Started", format: "timestamp" },
          { id: "endTime", label: "Ended", format: "timestamp" },
          { id: "duration", label: "Duration (ms)", format: "number" },
          { id: "cores", label: "Cores", format: "number" },
          { id: "memory", label: "Memory", format: "text" },
        ],
      },
    },
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const base = connection.url.replace(/\/$/, "");
    const mode = connection.mode ?? "history";
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
    function overviewItems(
      applications: Array<{ completed?: boolean }>,
    ): Array<{ label: string; value: unknown }> {
      const completed = applications.filter((app) => app.completed).length;
      return [
        { label: "Applications", value: applications.length },
        { label: "Active", value: applications.length - completed },
        { label: "Completed", value: completed },
      ];
    }
    function masterOverview(
      state: MasterState,
    ): Array<{ label: string; value: unknown }> {
      return [
        {
          label: "Applications",
          value: state.activeapps.length + state.completedapps.length,
        },
        { label: "Active", value: state.activeapps.length },
        { label: "Completed", value: state.completedapps.length },
        { label: "Workers", value: state.workers.length },
        { label: "Cores", value: state.cores },
      ];
    }
    return {
      async health() {
        const started = Date.now();
        try {
          if (mode === "master") {
            const state = await sparkGet<MasterState>("/json/");
            const count = state.activeapps.length + state.completedapps.length;
            return {
              status: "healthy",
              checkedAt: new Date().toISOString(),
              latencyMs: Date.now() - started,
              detail: `${count} application(s)`,
            };
          }
          const applications = await sparkGet<HistoryApplication[]>(
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
            detail:
              mode === "master"
                ? "Unable to reach Spark master"
                : "Unable to reach Spark history server",
          };
        }
      },
      async execute(operationId, input) {
        if (
          operationId === "service-info" ||
          operationId === "overview" ||
          operationId === "metrics"
        ) {
          if (mode === "master") {
            const state = await sparkGet<MasterState>("/json/");
            return { items: masterOverview(state) };
          }
          const applications = await sparkGet<HistoryApplication[]>(
            "/api/v1/applications",
          );
          return { items: overviewItems(applications) };
        }
        if (operationId === "applications") {
          const { limit } = pageInput.parse(input);
          if (mode === "master") {
            const state = await sparkGet<MasterState>("/json/");
            const all = [...state.activeapps, ...state.completedapps];
            const items = all.slice(0, limit).map((app) => ({
              id: app.id,
              name: app.name,
              sparkUser: app.user,
              startTime: new Date(app.submitDate).toISOString(),
              state: app.state,
            }));
            return {
              items,
              nextCursor: all.length > items.length ? "unsupported" : undefined,
            };
          }
          const applications = await sparkGet<HistoryApplication[]>(
            "/api/v1/applications",
          );
          const items = applications.slice(0, limit).map((app) => ({
            id: app.id,
            name: app.name,
            sparkUser: app.sparkUser ?? "",
            startTime: app.startTime,
            state: app.completed ? "FINISHED" : "RUNNING",
          }));
          return {
            items,
            nextCursor:
              applications.length > items.length ? "unsupported" : undefined,
          };
        }
        if (operationId === "app-detail") {
          const { id, appId } = appInput.parse(input);
          const resolved = id ?? appId;
          if (!resolved) throw new Error("Application id is required");
          if (mode === "master") {
            const state = await sparkGet<MasterState>("/json/");
            const app = [...state.activeapps, ...state.completedapps].find(
              (candidate) => candidate.id === resolved,
            );
            if (!app) throw new Error(`Unknown Spark application: ${resolved}`);
            return {
              items: [
                {
                  id: app.id,
                  name: app.name,
                  status: app.state,
                  user: app.user,
                  startTime: new Date(app.submitDate).toISOString(),
                  endTime:
                    app.state === "RUNNING"
                      ? ""
                      : new Date(app.submitDate + app.duration).toISOString(),
                  duration: app.duration,
                  cores: app.cores,
                  memory: app.memory,
                },
              ],
            };
          }
          const app = await sparkGet<HistoryApplication>(
            `/api/v1/applications/${resolved}`,
          );
          const attempt = app.attempts?.[0];
          const startTime = attempt?.startTime ?? "";
          const endTime = attempt?.endTime ?? "";
          const duration =
            endTime && startTime
              ? Date.parse(endTime) - Date.parse(startTime)
              : 0;
          return {
            items: [
              {
                id: app.id,
                name: app.name,
                status: attempt?.completed ? "FINISHED" : "RUNNING",
                user: attempt?.sparkUser ?? app.sparkUser ?? "",
                startTime,
                endTime,
                duration,
                cores: "",
                memory: "",
              },
            ],
          };
        }
        throw new Error(`Unsupported Spark operation: ${operationId}`);
      },
    };
  },
});
export default sparkAdapter;
