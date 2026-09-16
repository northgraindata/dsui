import { realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  createDbtLocalExecutor,
  type DbtCommandRequest,
  type DbtLocalExecutionDependencies,
  type DbtSecretResolver,
} from "@northgraindata/dsui-adapter-dbt";
import {
  LocalProcessRunner,
  type ProcessOutputChunk,
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
