import { z } from "@northgraindata/dsui-adapter-sdk";
import type {
  ShaperApp,
  ShaperClient,
  ShaperDashboard,
  ShaperDatabase,
  ShaperDeployResult,
  ShaperHttpConfig,
  ShaperSqlResult,
  ShaperSystemConfig,
} from "./context.js";
import { parseCsv } from "./csv.js";

const MAX_JSON_BYTES = 8 * 1024 * 1024;
/** SQL results stream without a row limit server-side; cap what we hold. */
const MAX_SQL_BYTES = 16 * 1024 * 1024;
const MAX_SQL_ROWS = 5_000;
const APPS_PAGE_SIZE = 200;
const MAX_APP_PAGES = 50;
const REQUEST_TIMEOUT_MS = 30_000;

const systemConfigSchema = z.object({
  loginRequired: z.boolean(),
  tasksEnabled: z.boolean(),
  editEnabled: z.boolean(),
  apiKeysEnabled: z.boolean(),
  ingestEnabled: z.boolean(),
  publicSharingEnabled: z.boolean().default(false),
  passwordProtectedSharingEnabled: z.boolean().default(false),
});

const taskInfoSchema = z
  .object({
    lastRunAt: z.string().optional(),
    lastRunSuccess: z.boolean().optional(),
    lastRunDuration: z.number().optional(),
    nextRunAt: z.string().optional(),
    nextRunType: z.string().optional(),
  })
  .partial();

const appSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["dashboard", "task", "_folder"]),
  path: z.string().default("/"),
  name: z.string(),
  content: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  visibility: z.enum(["private", "public", "password-protected"]).nullish(),
  taskInfo: taskInfoSchema.nullish(),
});
const appsSchema = z.object({ apps: z.array(appSchema) });

const columnSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().default(false),
  comment: z.string().nullish(),
});
const relationSchema = z.object({
  name: z.string(),
  comment: z.string().nullish(),
  columns: z.array(columnSchema).default([]),
  definition: z.string().optional(),
});
const schemaResponse = z.object({
  databases: z
    .array(
      z.object({
        name: z.string(),
        schemas: z.array(
          z.object({
            name: z.string(),
            tables: z.array(relationSchema).default([]),
            views: z.array(relationSchema).default([]),
            enums: z
              .array(
                z.object({ name: z.string(), values: z.array(z.string()) }),
              )
              .default([]),
          }),
        ),
      }),
    )
    .default([]),
});

const dashboardSchema = z.object({
  name: z.string().default(""),
  visibility: z.enum(["private", "public", "password-protected"]).nullish(),
  sections: z
    .array(
      z.object({
        title: z.string().nullable().default(null),
        subtitle: z.string().nullish(),
        type: z.string(),
        queries: z.array(
          z.object({
            render: z
              .object({
                type: z.string(),
                label: z.string().nullish(),
                subtitle: z.string().nullish(),
                class: z.string().nullish(),
                gaugeCategories: z.unknown().optional(),
                markLines: z.unknown().optional(),
              })
              .passthrough(),
            columns: z.array(
              z.object({
                name: z.string(),
                type: z.string(),
                nullable: z.boolean().default(false),
                tag: z.string().default(""),
              }),
            ),
            rows: z.array(z.array(z.unknown())),
          }),
        ),
      }),
    )
    .default([]),
  reloadAt: z.number().optional(),
  unsetVariables: z.array(z.string()).optional(),
});

const deploySchema = z.object({
  results: z.array(
    z.object({
      operation: z.string(),
      type: z.string(),
      id: z.string().optional(),
      status: z.string(),
    }),
  ),
});
const validateSchema = z.object({
  valid: z.boolean(),
  duration: z.number().default(0),
  error: z.string().optional(),
});
const tokenSchema = z.object({ jwt: z.string().min(1) });
const downloadUrlSchema = z.object({ url: z.string().min(1) });

/** Normalises a user-supplied address to a base URL ending in one slash. */
export function normalizeBaseUrl(value: string): URL {
  const url = new URL(value.trim());
  url.search = "";
  url.hash = "";
  url.pathname = `${url.pathname.replace(/\/(?:api|view)(?:\/.*)?$/, "").replace(/\/+$/, "")}/`;
  return url;
}

function errorDetail(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const value = (body as { error: unknown }).error;
    if (typeof value === "string") return value;
  }
  return "";
}

export function createShaperClient(
  config: ShaperHttpConfig,
  fetchFn: typeof fetch = fetch,
): ShaperClient {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const lifetime = new AbortController();
  const decoder = new TextDecoder();

  async function readBytes(
    response: Response,
    limit: number,
    signal: AbortSignal,
  ): Promise<string> {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limit) {
      await response.body?.cancel();
      throw new Error("Shaper response exceeds byte limit");
    }
    const reader = response.body?.getReader();
    if (!reader) return "";
    let text = "";
    let length = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > limit)
          throw new Error("Shaper response exceeds byte limit");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return text;
  }

  async function send(
    path: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    authorization: string,
  ): Promise<{ response: Response; signal: AbortSignal }> {
    const combined = AbortSignal.any([
      lifetime.signal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(signal ? [signal] : []),
    ]);
    combined.throwIfAborted();
    const response = await fetchFn(new URL(path, baseUrl), {
      ...init,
      headers: {
        Authorization: `Bearer ${authorization}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        "User-Agent": "dsui-shaper/0.1",
        ...(init.headers as Record<string, string> | undefined),
      },
      redirect: "error",
      signal: combined,
    });
    return { response, signal: combined };
  }

  async function failure(response: Response, signal: AbortSignal) {
    let detail = "";
    try {
      detail = errorDetail(
        JSON.parse(await readBytes(response, 64 * 1024, signal)),
      );
    } catch {
      // The status code alone is still actionable.
    }
    if (response.status === 401)
      return new Error(
        `Shaper rejected the API key${detail ? `: ${detail}` : ""}`,
      );
    if (response.status === 403)
      return new Error(
        `The Shaper API key lacks a required permission${detail ? `: ${detail}` : ""}`,
      );
    return new Error(
      `Shaper request failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  async function json<TSchema extends z.ZodTypeAny>(
    path: string,
    schema: TSchema,
    options: {
      signal?: AbortSignal;
      init?: RequestInit;
      authorization?: string;
    } = {},
  ): Promise<z.output<TSchema>> {
    const { response, signal } = await send(
      path,
      { ...options.init, headers: { Accept: "application/json" } },
      options.signal,
      options.authorization ?? config.apiKey,
    );
    if (!response.ok) throw await failure(response, signal);
    let body: unknown;
    try {
      body = JSON.parse(await readBytes(response, MAX_JSON_BYTES, signal));
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error("Invalid Shaper JSON response");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error("Invalid Shaper response");
    return parsed.data;
  }

  /** A short-lived token scoped to one dashboard, minted from the API key. */
  async function dashboardToken(
    id: string,
    variables: Record<string, string | string[]>,
    signal?: AbortSignal,
  ): Promise<string> {
    const { jwt } = await json("api/auth/token", tokenSchema, {
      signal,
      init: {
        method: "POST",
        body: JSON.stringify({
          token: config.apiKey,
          dashboardId: id,
          variables,
        }),
      },
    });
    return jwt;
  }

  return {
    dispose: () => lifetime.abort(),

    async health(signal) {
      const { response, signal: combined } = await send(
        "health",
        { method: "GET" },
        signal,
        config.apiKey,
      );
      await response.body?.cancel();
      if (!response.ok) throw await failure(response, combined);
    },

    getSystemConfig: (signal) =>
      json("api/system/config", systemConfigSchema, {
        signal,
      }) as Promise<ShaperSystemConfig>,

    async listApps(signal) {
      const apps: ShaperApp[] = [];
      for (let page = 0; page < MAX_APP_PAGES; page++) {
        const query = new URLSearchParams({
          recursive: "true",
          include_content: "true",
          sort: "name",
          order: "asc",
          limit: String(APPS_PAGE_SIZE),
          offset: String(page * APPS_PAGE_SIZE),
        });
        const { apps: batch } = await json(`api/apps?${query}`, appsSchema, {
          signal,
        });
        for (const app of batch) {
          apps.push({
            ...app,
            visibility: app.visibility ?? undefined,
            taskInfo: app.taskInfo ?? undefined,
          });
        }
        if (batch.length < APPS_PAGE_SIZE) break;
      }
      return apps;
    },

    async getSchema(signal) {
      const { databases } = await json("api/schema", schemaResponse, {
        signal,
      });
      return databases.map(
        (database): ShaperDatabase => ({
          name: database.name,
          schemas: database.schemas.map((namespace) => ({
            name: namespace.name,
            enums: namespace.enums,
            relations: [
              ...namespace.tables.map((table) => ({
                ...table,
                kind: "table" as const,
                comment: table.comment ?? undefined,
                columns: table.columns.map((column) => ({
                  ...column,
                  comment: column.comment ?? undefined,
                })),
              })),
              ...namespace.views.map((view) => ({
                ...view,
                kind: "view" as const,
                comment: view.comment ?? undefined,
                columns: view.columns.map((column) => ({
                  ...column,
                  comment: column.comment ?? undefined,
                })),
              })),
            ],
          })),
        }),
      );
    },

    async runSql(sql, signal): Promise<ShaperSqlResult> {
      const { response, signal: combined } = await send(
        "api/sql",
        { method: "POST", body: JSON.stringify({ sql }) },
        signal,
        config.apiKey,
      );
      if (!response.ok) throw await failure(response, combined);
      const text = await readBytes(response, MAX_SQL_BYTES, combined);
      const table = parseCsv(text, MAX_SQL_ROWS);
      return {
        columns: table.columns,
        rows: table.rows,
        truncated: table.truncated,
      };
    },

    validateDashboard: (sql, signal) =>
      json("api/validate", validateSchema, {
        signal,
        init: {
          method: "POST",
          body: JSON.stringify({ type: "dashboard", sql }),
        },
      }),

    async deploy(operations, signal): Promise<ShaperDeployResult[]> {
      const { results } = await json("api/deploy", deploySchema, {
        signal,
        init: { method: "POST", body: JSON.stringify({ apps: operations }) },
      });
      return results.map((result) => ({ ...result }));
    },

    async getDashboard(id, variables, signal): Promise<ShaperDashboard> {
      const jwt = await dashboardToken(id, variables, signal);
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(variables)) {
        for (const item of Array.isArray(value) ? value : [value])
          query.append(key, item);
      }
      const suffix = query.size > 0 ? `?${query}` : "";
      const dashboard = await json(
        `api/dashboards/${encodeURIComponent(id)}${suffix}`,
        dashboardSchema,
        { signal, authorization: jwt },
      );
      return { ...dashboard, visibility: dashboard.visibility ?? undefined };
    },

    async requestDownloadUrl(id, filename, signal) {
      const query = new URLSearchParams({ mode: "url" });
      const { url } = await json(
        `api/dashboards/${encodeURIComponent(id)}/download/${encodeURIComponent(filename)}?${query}`,
        downloadUrlSchema,
        { signal },
      );
      return new URL(url, baseUrl).toString();
    },
  };
}
