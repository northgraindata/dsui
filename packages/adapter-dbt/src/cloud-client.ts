import { z } from "@northgraindata/dsui-adapter-sdk";
import type { DbtCloudConfig } from "./context.js";
import type { DbtSecretResolver } from "./local.js";

const objectSchema = z.record(z.unknown());
const envelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data }).passthrough();
const accountSchema = z
  .object({ id: z.union([z.string(), z.number()]) })
  .passthrough();
const projectSchema = z
  .object({ id: z.union([z.string(), z.number()]) })
  .passthrough();
const environmentSchema = z
  .object({ id: z.union([z.string(), z.number()]) })
  .passthrough();
const jobSchema = z
  .object({ id: z.union([z.string(), z.number()]) })
  .passthrough();
const runSchema = z
  .object({ id: z.union([z.string(), z.number()]) })
  .passthrough();
const artifactSchema = z.object({ name: z.string().min(1) }).passthrough();
const listSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      data: z.array(item),
      status: z.unknown().optional(),
    })
    .passthrough();

export type DbtCloudAccount = z.output<typeof accountSchema>;
export type DbtCloudProject = z.output<typeof projectSchema>;
export type DbtCloudEnvironment = z.output<typeof environmentSchema>;
export type DbtCloudJob = z.output<typeof jobSchema>;
export type DbtCloudRun = z.output<typeof runSchema>;
export type DbtCloudArtifact = z.output<typeof artifactSchema>;
export type DbtCloudList<T> = {
  readonly data: T[];
  readonly [key: string]: unknown;
};

export interface DbtCloudRequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface DbtCloudListOptions extends DbtCloudRequestOptions {
  readonly limit?: number;
  readonly offset?: number;
}

export type DbtCloudFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface DbtCloudClientDependencies {
  readonly secretResolver: DbtSecretResolver;
  readonly fetch?: DbtCloudFetch;
  readonly timeoutMs?: number;
}

export interface DbtCloudClient {
  readonly baseUrl: string;
  getAccount(options?: DbtCloudRequestOptions): Promise<DbtCloudAccount>;
  listProjects(
    options?: DbtCloudListOptions,
  ): Promise<DbtCloudList<DbtCloudProject>>;
  getProject(
    projectId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudProject>;
  listEnvironments(
    options?: DbtCloudListOptions,
  ): Promise<DbtCloudList<DbtCloudEnvironment>>;
  getEnvironment(
    environmentId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudEnvironment>;
  listJobs(options?: DbtCloudListOptions): Promise<DbtCloudList<DbtCloudJob>>;
  getJob(
    jobId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudJob>;
  triggerJob(
    jobId: string | number,
    body?: unknown,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudRun>;
  rerunJob(
    jobId: string | number,
    body?: unknown,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudRun>;
  listRuns(options?: DbtCloudListOptions): Promise<DbtCloudList<DbtCloudRun>>;
  getRun(
    runId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudRun>;
  cancelRun(
    runId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudRun>;
  retryRun(
    runId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<DbtCloudRun>;
  getRunLogs(
    runId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<unknown>;
  getStepLogs(
    runId: string | number,
    stepId: string | number,
    options?: DbtCloudRequestOptions,
  ): Promise<unknown>;
  listRunArtifacts(
    runId: string | number,
    options?: DbtCloudListOptions,
  ): Promise<DbtCloudList<DbtCloudArtifact>>;
  getRunArtifact(
    runId: string | number,
    artifactPath: string,
    options?: DbtCloudRequestOptions,
  ): Promise<unknown>;
  listJobArtifacts(
    jobId: string | number,
    stepId?: string | number,
    options?: DbtCloudListOptions,
  ): Promise<DbtCloudList<DbtCloudArtifact>>;
  dispose(): void;
}

export const dbtCloudRoutes = {
  account: (accountId: string) => `/api/v3/accounts/${segment(accountId)}/`,
  projects: (accountId: string) =>
    `/api/v3/accounts/${segment(accountId)}/projects/`,
  project: (accountId: string, projectId: string | number) =>
    `/api/v3/accounts/${segment(accountId)}/projects/${segment(projectId)}/`,
  environments: (accountId: string) =>
    `/api/v3/accounts/${segment(accountId)}/environments/`,
  environment: (accountId: string, environmentId: string | number) =>
    `/api/v3/accounts/${segment(accountId)}/environments/${segment(environmentId)}/`,
  jobs: (accountId: string) => `/api/v2/accounts/${segment(accountId)}/jobs/`,
  job: (accountId: string, jobId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/jobs/${segment(jobId)}/`,
  triggerJob: (accountId: string, jobId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/jobs/${segment(jobId)}/run/`,
  rerunJob: (accountId: string, jobId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/jobs/${segment(jobId)}/rerun/`,
  runs: (accountId: string) => `/api/v2/accounts/${segment(accountId)}/runs/`,
  run: (accountId: string, runId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/runs/${segment(runId)}/`,
  cancelRun: (accountId: string, runId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/runs/${segment(runId)}/cancel/`,
  retryRun: (accountId: string, runId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/runs/${segment(runId)}/retry/`,
  runLogs: (accountId: string, runId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/runs/${segment(runId)}/logs/`,
  stepLogs: (
    accountId: string,
    runId: string | number,
    stepId: string | number,
  ) =>
    `/api/v2/accounts/${segment(accountId)}/runs/${segment(runId)}/steps/${segment(stepId)}/logs/`,
  runArtifacts: (accountId: string, runId: string | number) =>
    `/api/v2/accounts/${segment(accountId)}/runs/${segment(runId)}/artifacts/`,
  runArtifact: (
    accountId: string,
    runId: string | number,
    artifactPath: string,
  ) =>
    `/api/v2/accounts/${segment(accountId)}/runs/${segment(runId)}/artifacts/${artifactPath.split("/").map(segment).join("/")}`,
  jobArtifacts: (
    accountId: string,
    jobId: string | number,
    stepId?: string | number,
  ) =>
    `/api/v2/accounts/${segment(accountId)}/jobs/${segment(jobId)}/artifacts/${stepId === undefined ? "" : `${segment(stepId)}/`}`,
} as const;

export class DbtCloudApiError extends Error {
  readonly status: number;
  readonly providerStatus: unknown;
  readonly providerMessage: string | undefined;
  readonly details: unknown;

  constructor(
    status: number,
    statusText: string,
    body: unknown,
    token: string,
  ) {
    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.detail === "string"
          ? record.detail
          : undefined;
    super(
      `dbt Cloud request failed (HTTP ${status})${message ? `: ${redact(message, token)}` : statusText ? `: ${statusText}` : ""}`,
    );
    this.name = "DbtCloudApiError";
    this.status = status;
    this.providerStatus = redactUnknown(record.status, token);
    this.providerMessage = message ? redact(message, token) : undefined;
    this.details = redactUnknown(body, token);
  }
}

function segment(value: string | number): string {
  return encodeURIComponent(String(value));
}

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "dbt Cloud base URL must use HTTP(S) without credentials, query, or fragment",
    );
  url.pathname = `${url.pathname.replace(/\/api\/v[23]\/?$/, "").replace(/\/+$/, "")}/`;
  return url;
}

function redact(value: string, token: string): string {
  return token ? value.split(token).join("[REDACTED]") : value;
}

function redactUnknown(value: unknown, token: string): unknown {
  if (typeof value === "string") return redact(value, token);
  if (Array.isArray(value))
    return value.map((item) => redactUnknown(item, token));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactUnknown(item, token),
      ]),
    );
  return value;
}

export function createDbtCloudClient(
  config: DbtCloudConfig,
  dependencies: DbtCloudClientDependencies,
): DbtCloudClient {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const fetchFn = dependencies.fetch ?? fetch;
  const lifetime = new AbortController();
  let tokenPromise: Promise<string> | undefined;

  async function token() {
    if (config.apiToken.value !== undefined) return config.apiToken.value;
    tokenPromise ??= dependencies.secretResolver.resolve(
      config.apiToken.secretRef,
    );
    return tokenPromise;
  }

  async function request<T extends z.ZodTypeAny>(
    path: string,
    schema: T,
    options: DbtCloudRequestOptions = {},
    init: RequestInit = {},
  ) {
    const authToken = await token();
    const timeout = options.timeoutMs ?? dependencies.timeoutMs ?? 30_000;
    const timeoutSignal = AbortSignal.timeout(timeout);
    const signal = AbortSignal.any([
      lifetime.signal,
      timeoutSignal,
      ...(options.signal ? [options.signal] : []),
    ]);
    signal.throwIfAborted();
    const response = await fetchFn(new URL(path.slice(1), baseUrl), {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      redirect: "error",
      signal,
    });
    let body: unknown;
    try {
      body = response.status === 204 ? undefined : await response.json();
    } catch {
      body = undefined;
    }
    if (!response.ok)
      throw new DbtCloudApiError(
        response.status,
        response.statusText,
        body,
        authToken,
      );
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error("Invalid dbt Cloud response");
    return parsed.data;
  }

  function query(path: string, options: DbtCloudListOptions = {}) {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.offset !== undefined)
      params.set("offset", String(options.offset));
    return `${path}${params.size ? `?${params}` : ""}`;
  }
  const list = <T extends z.ZodTypeAny>(item: T) => listSchema(item);
  return {
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
    dispose: () => lifetime.abort(),
    getAccount: (options) =>
      request(
        dbtCloudRoutes.account(config.accountId),
        envelopeSchema(accountSchema),
        options,
      ).then((result) => result.data),
    listProjects: (options) =>
      request(
        query(dbtCloudRoutes.projects(config.accountId), options),
        list(projectSchema),
        options,
      ),
    getProject: (id, options) =>
      request(
        dbtCloudRoutes.project(config.accountId, id),
        envelopeSchema(projectSchema),
        options,
      ).then((result) => result.data),
    listEnvironments: (options) =>
      request(
        query(dbtCloudRoutes.environments(config.accountId), options),
        list(environmentSchema),
        options,
      ),
    getEnvironment: (id, options) =>
      request(
        dbtCloudRoutes.environment(config.accountId, id),
        envelopeSchema(environmentSchema),
        options,
      ).then((result) => result.data),
    listJobs: (options) =>
      request(
        query(dbtCloudRoutes.jobs(config.accountId), options),
        list(jobSchema),
        options,
      ),
    getJob: (id, options) =>
      request(
        dbtCloudRoutes.job(config.accountId, id),
        envelopeSchema(jobSchema),
        options,
      ).then((result) => result.data),
    triggerJob: (id, body, options) =>
      request(
        dbtCloudRoutes.triggerJob(config.accountId, id),
        envelopeSchema(runSchema),
        options,
        { method: "POST", body: JSON.stringify(body ?? {}) },
      ).then((result) => result.data),
    rerunJob: (id, body, options) =>
      request(
        dbtCloudRoutes.rerunJob(config.accountId, id),
        envelopeSchema(runSchema),
        options,
        { method: "POST", body: JSON.stringify(body ?? {}) },
      ).then((result) => result.data),
    listRuns: (options) =>
      request(
        query(dbtCloudRoutes.runs(config.accountId), options),
        list(runSchema),
        options,
      ),
    getRun: (id, options) =>
      request(
        dbtCloudRoutes.run(config.accountId, id),
        envelopeSchema(runSchema),
        options,
      ).then((result) => result.data),
    cancelRun: (id, options) =>
      request(
        dbtCloudRoutes.cancelRun(config.accountId, id),
        envelopeSchema(runSchema),
        options,
        { method: "POST", body: "{}" },
      ).then((result) => result.data),
    retryRun: (id, options) =>
      request(
        dbtCloudRoutes.retryRun(config.accountId, id),
        envelopeSchema(runSchema),
        options,
        { method: "POST", body: "{}" },
      ).then((result) => result.data),
    getRunLogs: (id, options) =>
      request(
        dbtCloudRoutes.runLogs(config.accountId, id),
        objectSchema,
        options,
      ),
    getStepLogs: (id, stepId, options) =>
      request(
        dbtCloudRoutes.stepLogs(config.accountId, id, stepId),
        objectSchema,
        options,
      ),
    listRunArtifacts: (id, options) =>
      request(
        query(dbtCloudRoutes.runArtifacts(config.accountId, id), options),
        list(artifactSchema),
        options,
      ),
    getRunArtifact: (id, path, options) =>
      request(
        dbtCloudRoutes.runArtifact(config.accountId, id, path),
        objectSchema,
        options,
      ),
    listJobArtifacts: (id, stepId, options) =>
      request(
        query(
          dbtCloudRoutes.jobArtifacts(config.accountId, id, stepId),
          options,
        ),
        list(artifactSchema),
        options,
      ),
  };
}
