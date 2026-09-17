import { z } from "@northgraindata/dsui-adapter-sdk";
import type { DbtCloudConfig } from "./context.js";

const accountSchema = z.object({
  id: z.coerce.string(),
  name: z.string().optional(),
  state: z.string().optional(),
});
const accountResponseSchema = z.object({ data: accountSchema });
const projectSchema = z.object({
  id: z.coerce.string(),
  name: z.string().min(1),
  account_id: z.coerce.string().optional(),
  state: z.string().optional(),
  repository: z.string().optional(),
});
const jobSchema = z.object({
  id: z.coerce.string(),
  name: z.string().min(1),
  project_id: z.coerce.string(),
  description: z.string().optional(),
  schedule: z.string().optional(),
  state: z.string().optional(),
});
const runSchema = z.object({
  id: z.coerce.string(),
  job_id: z.coerce.string(),
  status: z.string().optional(),
  cause: z.string().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
});
const projectCollectionSchema = z.object({ data: z.array(projectSchema) });
const jobCollectionSchema = z.object({ data: z.array(jobSchema) });
const artifactSchema = z.object({
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
  content_type: z.string().optional(),
});
const artifactCollectionSchema = z.object({ data: z.array(artifactSchema) });

export type DbtCloudAccount = z.output<typeof accountSchema>;
export type DbtCloudProject = z.output<typeof projectSchema>;
export type DbtCloudJob = z.output<typeof jobSchema>;
export type DbtCloudRun = z.output<typeof runSchema>;
export type DbtCloudArtifact = z.output<typeof artifactSchema>;

export interface DbtCloudClient {
  getAccount(signal?: AbortSignal): Promise<DbtCloudAccount>;
  listProjects(signal?: AbortSignal): Promise<DbtCloudProject[]>;
  listJobs(signal?: AbortSignal): Promise<DbtCloudJob[]>;
  triggerJob(
    jobId: string,
    input: { cause: string; stepsOverride?: string[] },
    signal?: AbortSignal,
  ): Promise<DbtCloudRun>;
  listRuns(signal?: AbortSignal): Promise<DbtCloudRun[]>;
  getRun(runId: string, signal?: AbortSignal): Promise<DbtCloudRun>;
  getRunLogs(runId: string, signal?: AbortSignal): Promise<string>;
  listArtifacts(
    runId: string,
    signal?: AbortSignal,
  ): Promise<DbtCloudArtifact[]>;
  cancelRun(runId: string, signal?: AbortSignal): Promise<DbtCloudRun>;
}

export class DbtCloudRequestError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string, detail?: string) {
    super(`dbt Cloud request failed (${status})${detail ? `: ${detail}` : ""}`);
    this.name = "DbtCloudRequestError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export function createDbtCloudClient(config: DbtCloudConfig): DbtCloudClient {
  const pageSize = 100;
  const maxPages = 20;

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    init?: RequestInit,
  ) {
    const endpoint = `${config.baseUrl.replace(/\/$/, "")}${path}`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        ...init,
        headers: {
          accept: "application/json",
          authorization: `Token ${config.apiToken}`,
          ...init?.headers,
        },
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(
        `dbt Cloud request could not reach ${new URL(endpoint).origin}`,
        { cause: error },
      );
    }
    if (!response.ok) {
      const detail = await response.text().then((body) => {
        try {
          const parsed = JSON.parse(body) as {
            error?: unknown;
            message?: unknown;
          };
          const value = parsed.error ?? parsed.message;
          return typeof value === "string" ? value.slice(0, 300) : undefined;
        } catch {
          return undefined;
        }
      });
      throw new DbtCloudRequestError(response.status, path, detail);
    }
    return schema.parse(await response.json());
  }

  async function listPages<T>(
    path: string,
    schema: z.ZodType<{ data: T[] }>,
    signal?: AbortSignal,
  ): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const response = await request(
        `${path}${separator}limit=${pageSize}&page=${page}`,
        schema,
        signal,
      );
      items.push(...response.data);
      if (response.data.length < pageSize) return items;
    }
    throw new Error(`dbt Cloud pagination exceeded ${maxPages} pages`);
  }

  return {
    async getAccount(signal) {
      return (
        await request(
          `/api/v3/accounts/${encodeURIComponent(config.accountId)}/`,
          accountResponseSchema,
          signal,
        )
      ).data;
    },
    async listProjects(signal) {
      return listPages(
        `/api/v3/accounts/${encodeURIComponent(config.accountId)}/projects/`,
        projectCollectionSchema,
        signal,
      );
    },
    async listJobs(signal) {
      return listPages(
        `/api/v3/accounts/${encodeURIComponent(config.accountId)}/jobs/`,
        jobCollectionSchema,
        signal,
      );
    },
    async triggerJob(jobId, input, signal) {
      return (
        await request(
          `/api/v2/accounts/${encodeURIComponent(config.accountId)}/jobs/${encodeURIComponent(jobId)}/run/`,
          z.object({ data: runSchema }),
          signal,
          {
            body: JSON.stringify({
              cause: input.cause,
              ...(input.stepsOverride
                ? { steps_override: input.stepsOverride }
                : {}),
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        )
      ).data;
    },
    async listRuns(signal) {
      return listPages(
        `/api/v2/accounts/${encodeURIComponent(config.accountId)}/runs/`,
        z.object({ data: z.array(runSchema) }),
        signal,
      );
    },
    async getRun(runId, signal) {
      return (
        await request(
          `/api/v2/accounts/${encodeURIComponent(config.accountId)}/runs/${encodeURIComponent(runId)}/`,
          z.object({ data: runSchema }),
          signal,
        )
      ).data;
    },
    async getRunLogs(runId, signal) {
      const response = await request(
        `/api/v2/accounts/${encodeURIComponent(config.accountId)}/runs/${encodeURIComponent(runId)}/logs/`,
        z.object({ data: z.string() }),
        signal,
      );
      return response.data;
    },
    async listArtifacts(runId, signal) {
      return (
        await request(
          `/api/v2/accounts/${encodeURIComponent(config.accountId)}/runs/${encodeURIComponent(runId)}/artifacts/`,
          artifactCollectionSchema,
          signal,
        )
      ).data;
    },
    async cancelRun(runId, signal) {
      return (
        await request(
          `/api/v2/accounts/${encodeURIComponent(config.accountId)}/runs/${encodeURIComponent(runId)}/cancel/`,
          z.object({ data: runSchema }),
          signal,
          { method: "POST" },
        )
      ).data;
    },
  };
}
