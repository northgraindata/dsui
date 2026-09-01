import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  baseUrl: z.string().url().default("https://cloud.getdbt.com"),
  accountId: z.coerce.number().int().positive(),
  token: z.string().min(1),
});
const pageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const resources = [
  ["connections", "Connections"],
  ["environments", "Environments"],
  ["invites", "Invites"],
  ["jobs", "Jobs"],
  ["licenses", "Licenses"],
  ["notifications", "Notifications"],
  ["permissions", "Permissions"],
  ["projects", "Projects"],
  ["repositories", "Repositories"],
  ["runs", "Runs"],
  ["users", "Users"],
] as const;
type DbtResponse<T = unknown> = {
  status?: {
    code?: number;
    is_success?: boolean;
    user_message?: string;
    developer_message?: string;
  };
  data?: T;
  extra?: { pagination?: { count?: number; total_count?: number } };
};

export const dbtCloudAdapter = defineAdapter({
  id: "dbt-cloud",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "dbt-cloud",
    name: "dbt Cloud",
    category: "Transformation",
    description:
      "Operate every dbt Cloud Administrative API v2 resource group.",
    icon: "dbt-cloud",
    docsUrl: "https://docs.getdbt.com/dbt-cloud/api-v2?version=2#/",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "baseUrl",
      label: "dbt Cloud URL",
      type: "url",
      required: true,
      placeholder: "https://cloud.getdbt.com",
    },
    { id: "accountId", label: "Account ID", type: "number", required: true },
    {
      id: "token",
      label: "Personal access token",
      type: "password",
      required: true,
      secret: true,
    },
  ],
  secretPaths: ["token"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Account" },
    },
    ...resources.map(([id, title]) => ({
      id,
      authorization: "inspect" as const,
      supportsPagination: true,
      maxPageSize: 100,
      view: {
        kind:
          id === "jobs" || id === "runs"
            ? ("job-browser" as const)
            : ("record-list" as const),
        title,
      },
    })),
    {
      id: "run-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Run detail" },
    },
    {
      id: "run-artifacts",
      authorization: "inspect",
      view: { kind: "record-list", title: "Run artifacts" },
    },
    {
      id: "artifact",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Artifact" },
    },
    {
      id: "trigger-job",
      authorization: "execute",
      view: { kind: "action-form", title: "Trigger job" },
    },
    {
      id: "cancel-run",
      authorization: "execute",
      view: { kind: "action-form", title: "Cancel run" },
    },
    {
      id: "retry-run",
      authorization: "execute",
      view: { kind: "action-form", title: "Retry run" },
    },
    {
      id: "api-request",
      authorization: "execute",
      view: { kind: "action-form", title: "Administrative API v2" },
    },
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const origin = connection.baseUrl.replace(/\/$/, "");
    const accountBase = `/api/v2/accounts/${connection.accountId}`;
    const headers = {
      Authorization: `Token ${connection.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    async function request<T = unknown>(
      path: string,
      init?: RequestInit,
    ): Promise<DbtResponse<T>> {
      const response = await fetchFn(`${origin}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
        signal: context.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("json")
        ? ((await response.json().catch(() => ({}))) as DbtResponse<T>)
        : ({ data: await response.text() } as DbtResponse<T>);
      if (!response.ok || body.status?.is_success === false)
        throw new Error(
          body.status?.user_message ??
            body.status?.developer_message ??
            `dbt Cloud responded ${response.status}`,
        );
      return body;
    }
    function list(resource: string, input: unknown) {
      const { limit, offset } = pageInput.parse(input);
      return request<unknown[]>(
        `${accountBase}/${resource}/?limit=${limit}&offset=${offset}`,
      ).then((body) => ({
        items: Array.isArray(body.data) ? body.data : [],
        nextCursor:
          (body.extra?.pagination?.total_count ?? 0) > offset + limit
            ? String(offset + limit)
            : undefined,
      }));
    }
    return {
      async health() {
        const started = Date.now();
        try {
          await request(`${accountBase}/`);
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
            detail: "Unable to access the dbt Cloud account",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "service-info") {
          const body = await request<Record<string, unknown>>(
            `${accountBase}/`,
          );
          return {
            items: [
              {
                label: "Account ID",
                value: connection.accountId,
                format: "number",
              },
              { label: "API region", value: origin, format: "code" },
              ...(body.data
                ? Object.entries(body.data)
                    .slice(0, 20)
                    .map(([label, value]) => ({
                      label,
                      value:
                        typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value ?? ""),
                    }))
                : []),
            ],
          };
        }
        if (resources.some(([id]) => id === operationId))
          return list(operationId, input);
        if (operationId === "run-detail") {
          const { runId } = z
            .object({ runId: z.coerce.number().int().positive() })
            .parse(input);
          return request(`${accountBase}/runs/${runId}/`).then(
            (body) => body.data,
          );
        }
        if (operationId === "run-artifacts") {
          const { runId, step } = z
            .object({
              runId: z.coerce.number().int().positive(),
              step: z.coerce.number().int().positive().optional(),
            })
            .parse(input);
          return request<string[]>(
            `${accountBase}/runs/${runId}/artifacts/${step ? `?step=${step}` : ""}`,
          ).then((body) => ({ items: body.data ?? [] }));
        }
        if (operationId === "artifact") {
          const { runId, path, step } = z
            .object({
              runId: z.coerce.number().int().positive(),
              path: z
                .string()
                .min(1)
                .refine(
                  (value) => !value.split("/").includes(".."),
                  "Artifact path cannot traverse directories",
                ),
              step: z.coerce.number().int().positive().optional(),
            })
            .parse(input);
          return request(
            `${accountBase}/runs/${runId}/artifacts/${path.split("/").map(encodeURIComponent).join("/")}${step ? `?step=${step}` : ""}`,
          ).then((body) => body.data);
        }
        if (operationId === "trigger-job") {
          const parsed = z
            .object({
              jobId: z.coerce.number().int().positive(),
              cause: z.string().default("Triggered by dsui"),
              gitSha: z.string().optional(),
              gitBranch: z.string().optional(),
              schemaOverride: z.string().optional(),
              dbtVersionOverride: z.string().optional(),
              threadsOverride: z.coerce.number().int().positive().optional(),
              stepsOverride: z.array(z.string()).optional(),
            })
            .parse(input);
          return request(`${accountBase}/jobs/${parsed.jobId}/run/`, {
            method: "POST",
            body: JSON.stringify({
              cause: parsed.cause,
              git_sha: parsed.gitSha,
              git_branch: parsed.gitBranch,
              schema_override: parsed.schemaOverride,
              dbt_version_override: parsed.dbtVersionOverride,
              threads_override: parsed.threadsOverride,
              steps_override: parsed.stepsOverride,
            }),
          }).then((body) => body.data);
        }
        if (operationId === "cancel-run" || operationId === "retry-run") {
          const { runId } = z
            .object({ runId: z.coerce.number().int().positive() })
            .parse(input);
          return request(
            `${accountBase}/runs/${runId}/${operationId === "cancel-run" ? "cancel" : "retry"}/`,
            { method: "POST", body: "{}" },
          ).then((body) => body.data);
        }
        if (operationId === "api-request") {
          const parsed = z
            .object({
              method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
              path: z
                .string()
                .regex(
                  /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*(?:\?[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*)?$/,
                )
                .refine(
                  (value) => !value.split(/[/?]/).includes(".."),
                  "Path cannot traverse directories",
                ),
              body: z.unknown().optional(),
            })
            .parse(input);
          return request(`${accountBase}${parsed.path}`, {
            method: parsed.method,
            ...(parsed.body === undefined
              ? {}
              : { body: JSON.stringify(parsed.body) }),
          }).then((body) => body.data);
        }
        throw new Error(`Unsupported dbt Cloud operation: ${operationId}`);
      },
    };
  },
});

export default dbtCloudAdapter;
