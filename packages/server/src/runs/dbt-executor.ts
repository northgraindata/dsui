import { realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  createDbtLocalExecutor,
  type DbtCloudClient,
  type DbtCloudRun,
  type DbtCommandRequest,
  type DbtLocalExecutionDependencies,
  type DbtSecretResolver,
} from "@northgraindata/dsui-adapter-dbt";
import {
  LocalProcessRunner,
  type ProcessOutputChunk,
  ProcessRunnerError,
} from "@northgraindata/dsui-process-runner";
import type { RunArtifact } from "./contracts.js";
import type {
  RunExecutor,
  RunExecutorRequest,
  RunExecutorResult,
} from "./service.js";

export interface DbtRunExecutorDependencies {
  readonly secretResolver: DbtSecretResolver;
  readonly runner?: DbtLocalExecutionDependencies["runner"];
  readonly allowedExecutables?: readonly string[];
  readonly cloud?: DbtCloudExecutionConfig;
}

export interface DbtCloudRunTarget {
  readonly jobId: string | number;
  readonly triggerBody?: unknown;
}

export interface DbtCloudExecutionConfig {
  readonly client: DbtCloudClient;
  /** Resolves an explicit Cloud job target; request fields are never guessed. */
  readonly targetResolver: (
    request: RunExecutorRequest["request"],
  ) => DbtCloudRunTarget | Promise<DbtCloudRunTarget>;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
}

const optionKeys = new Set([
  "select",
  "exclude",
  "vars",
  "fullRefresh",
  "defer",
  "state",
  "failFast",
  "threads",
  "targetPath",
]);

function dbtArgs(
  args: RunExecutorRequest["request"]["args"],
): Pick<
  DbtCommandRequest,
  | "select"
  | "exclude"
  | "vars"
  | "fullRefresh"
  | "defer"
  | "state"
  | "failFast"
  | "threads"
  | "targetPath"
> {
  const values = args ?? {};
  for (const key of Object.keys(values))
    if (!optionKeys.has(key))
      throw new Error(`Unsupported dbt run argument: ${key}`);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "select" || key === "exclude") {
      if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === "string")
      )
        throw new Error(`${key} must be an array of strings`);
      result[key] = value;
    } else if (key === "vars") {
      if (typeof value !== "string") throw new Error("vars must be JSON");
      let parsed: unknown;
      try {
        parsed = JSON.parse(value) as unknown;
      } catch {
        throw new Error("vars must be valid JSON");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("vars must be a JSON object");
      result[key] = parsed;
    } else if (key === "threads") {
      if (typeof value !== "string")
        throw new Error("threads must be a string");
      const threads = Number(value);
      if (!Number.isInteger(threads) || threads < 1)
        throw new Error("threads must be a positive integer");
      result[key] = threads;
    } else if (key === "state" || key === "targetPath") {
      if (typeof value !== "string") throw new Error(`${key} must be a string`);
      result[key] = value;
    } else {
      if (typeof value !== "boolean") throw new Error(`${key} must be boolean`);
      result[key] = value;
    }
  }
  return result as Pick<
    DbtCommandRequest,
    | "select"
    | "exclude"
    | "vars"
    | "fullRefresh"
    | "defer"
    | "state"
    | "failFast"
    | "threads"
    | "targetPath"
  >;
}

function isWithin(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

async function artifacts(
  projectPath: string,
  targetPath: string | undefined,
  invocationId: string,
): Promise<RunArtifact[]> {
  const canonicalProject = await realpath(projectPath);
  const root = await realpath(
    targetPath ?? join(canonicalProject, "target"),
  ).catch(() => undefined);
  if (!root || !isWithin(canonicalProject, root)) return [];

  const definitions = [
    ["manifest", "manifest.json"],
    ["catalog", "catalog.json"],
    ["run_results", "run_results.json"],
    ["sources", "sources.json"],
  ] as const;
  const result: RunArtifact[] = [];
  for (const [kind, filename] of definitions) {
    const ref = join(root, filename);
    const canonicalRef = await realpath(ref).catch(() => undefined);
    if (!canonicalRef || !isWithin(root, canonicalRef)) continue;
    const file = await Bun.file(canonicalRef).exists();
    if (!file) continue;
    const size = Bun.file(canonicalRef).size;
    result.push({
      artifactId: kind,
      kind,
      contentType: "application/json",
      byteSize: size,
      generatedAt: new Date().toISOString(),
      invocationId,
      location: { kind: "local", ref: canonicalRef },
      parseStatus: "pending",
      downloadable: true,
    });
  }
  return result;
}

function outputEvent(chunk: ProcessOutputChunk) {
  return {
    type: "output" as const,
    at: new Date().toISOString(),
    stream: chunk.stream,
    text: chunk.text,
  };
}

function redactCloudOutput(
  text: string,
  request: RunExecutorRequest["request"],
): string {
  return Object.values(request.environment ?? {}).reduce((result, value) => {
    if (
      !("value" in value) ||
      typeof value.value !== "string" ||
      value.value.length === 0
    )
      return result;
    return result.split(value.value).join("[REDACTED]");
  }, text);
}

const terminalStatuses = new Set([
  "success",
  "succeeded",
  "error",
  "failed",
  "failure",
  "cancelled",
  "canceled",
]);

function providerStatus(run: DbtCloudRun) {
  const value = run as Record<string, unknown>;
  const status = value.status;
  const statusText = typeof status === "string" ? status : String(status);
  const numericStatus = typeof status === "number" ? status : Number(status);
  const terminal =
    numericStatus === 10 ||
    numericStatus === 20 ||
    numericStatus === 30 ||
    terminalStatuses.has(statusText.toLowerCase());
  const message = ["message", "statusMessage", "jobStatusMessage"]
    .map((key) => value[key])
    .find((candidate): candidate is string => typeof candidate === "string");
  return {
    terminal,
    status: {
      provider: "dbt-cloud",
      status: statusText,
      ...(typeof value.statusCode === "string"
        ? { code: value.statusCode }
        : {}),
      ...(message ? { message } : {}),
    },
    success:
      numericStatus === 10 ||
      ["success", "succeeded"].includes(statusText.toLowerCase()),
    cancelled:
      numericStatus === 30 ||
      ["cancelled", "canceled"].includes(statusText.toLowerCase()),
  };
}

function logText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["log", "logs", "text", "stdout", "content"])
    if (typeof record[key] === "string") return record[key];
  return undefined;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(
        signal.reason ??
          new DOMException("The operation was aborted", "AbortError"),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function executeCloud(
  config: DbtCloudExecutionConfig,
  request: RunExecutorRequest["request"],
  signal: AbortSignal,
  onOutput: RunExecutorRequest["onOutput"],
): Promise<RunExecutorResult> {
  const target = await config.targetResolver(request);
  const intervalMs = config.pollIntervalMs ?? 2_000;
  if (!Number.isFinite(intervalMs) || intervalMs < 0)
    throw new Error("Cloud pollIntervalMs must be non-negative");
  const timeoutMs = request.timeoutMs ?? config.timeoutMs ?? 600_000;
  const started = Date.now();
  const triggered = await config.client.triggerJob(
    target.jobId,
    target.triggerBody,
    { signal },
  );
  const runId = triggered.id;
  let cancelled = false;
  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    await config.client.cancelRun(runId, { signal: undefined });
  };

  try {
    let current = triggered;
    while (true) {
      const state = providerStatus(current);
      if (state.terminal) {
        const logs = await config.client
          .getRunLogs(runId, { signal })
          .catch(() => undefined);
        const text = logText(logs);
        if (text)
          onOutput({
            type: "output",
            at: new Date().toISOString(),
            stream: "stdout",
            text: redactCloudOutput(text, request),
          });
        return {
          exitCode: state.cancelled ? 130 : state.success ? 0 : 1,
          durationMs: Date.now() - started,
          providerStatus: state.status,
        };
      }
      if (signal.aborted) {
        await cancel();
        const status = providerStatus(await config.client.getRun(runId)).status;
        return {
          exitCode: 130,
          durationMs: Date.now() - started,
          providerStatus: status,
        };
      }
      if (Date.now() - started >= timeoutMs) {
        await cancel();
        throw new ProcessRunnerError(
          "TIMEOUT",
          `dbt Cloud run timed out after ${timeoutMs}ms`,
        );
      }
      await wait(
        Math.min(intervalMs, timeoutMs - (Date.now() - started)),
        signal,
      ).catch(async (error) => {
        if (!signal.aborted) throw error;
        await cancel();
        throw new ProcessRunnerError(
          "CANCELLED",
          "dbt Cloud run was cancelled",
        );
      });
      current = await config.client.getRun(runId, { signal });
    }
  } catch (error) {
    if (signal.aborted && !cancelled) await cancel();
    throw error;
  }
}

export function createDbtRunExecutor(
  dependencies: DbtRunExecutorDependencies,
): RunExecutor {
  const runner = dependencies.runner ?? new LocalProcessRunner();
  const executor = createDbtLocalExecutor({
    runner,
    secretResolver: dependencies.secretResolver,
    allowedExecutables: dependencies.allowedExecutables,
  });

  return {
    async execute({
      invocationId,
      request,
      signal,
      onOutput,
    }: RunExecutorRequest): Promise<RunExecutorResult> {
      if (dependencies.cloud)
        return executeCloud(dependencies.cloud, request, signal, onOutput);
      if ("cloud" in (request as object))
        throw new Error(
          "dbt Cloud execution is not supported by the local runtime",
        );
      if ("uploadId" in request.project)
        throw new Error(
          "dbt local execution does not support project uploadId",
        );
      const profile = request.profile;
      const dbtRequest: DbtCommandRequest = {
        command:
          request.command === "docs_generate"
            ? "docs-generate"
            : request.command,
        projectPath: request.project.path,
        ...(request.cwd ? { cwd: request.cwd } : {}),
        ...(profile?.name ? { profile: profile.name } : {}),
        ...(profile?.target ? { target: profile.target } : {}),
        ...dbtArgs(request.args),
        environment: request.environment,
      };
      const result = await executor.execute(dbtRequest, signal, {
        timeoutMs: request.timeoutMs,
        onOutput: (chunk) => onOutput(outputEvent(chunk)),
      });
      return {
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        artifacts: await artifacts(
          request.project.path,
          dbtRequest.targetPath,
          invocationId,
        ),
      };
    },
  };
}
