import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type {
  ProcessRunRequest,
  ProcessRunResult,
} from "@northgraindata/dsui-process-runner";
import type { DbtCommandId, EnvironmentValue } from "./context.js";

export interface DbtCommandRequest {
  readonly command: DbtCommandId;
  readonly projectPath: string;
  readonly cwd?: string;
  readonly profilesDir?: string;
  readonly profile?: string;
  readonly target?: string;
  readonly targetPath?: string;
  readonly executable?: string;
  readonly select?: readonly string[];
  readonly exclude?: readonly string[];
  readonly vars?: Readonly<Record<string, string | number | boolean | null>>;
  readonly fullRefresh?: boolean;
  readonly defer?: boolean;
  readonly state?: string;
  readonly failFast?: boolean;
  readonly threads?: number;
  readonly environment?: Readonly<Record<string, EnvironmentValue>>;
}

export interface DbtCommandPlan {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface DbtSecretResolver {
  resolve(secretRef: string): Promise<string>;
}

export interface DbtLocalExecutor {
  execute(
    request: DbtCommandRequest,
    signal?: AbortSignal,
    options?: {
      readonly timeoutMs?: number;
      readonly onOutput?: ProcessRunRequest["onOutput"];
    },
  ): Promise<ProcessRunResult>;
}

export interface DbtLocalExecutionDependencies {
  readonly runner: {
    run(request: ProcessRunRequest): Promise<ProcessRunResult>;
  };
  readonly secretResolver: DbtSecretResolver;
  readonly allowedExecutables?: readonly string[];
}

const commandFlags: Readonly<Record<DbtCommandId, readonly string[]>> = {
  run: [
    "select",
    "exclude",
    "vars",
    "fullRefresh",
    "defer",
    "state",
    "failFast",
    "threads",
  ],
  build: [
    "select",
    "exclude",
    "vars",
    "fullRefresh",
    "defer",
    "state",
    "failFast",
    "threads",
  ],
  test: ["select", "exclude", "vars", "defer", "state", "failFast", "threads"],
  compile: ["select", "exclude", "vars", "defer", "state", "threads"],
  "docs-generate": [],
};

function canonicalPath(value: string, label: string): string {
  if (!isAbsolute(value)) throw new Error(`${label} must be an absolute path`);

  const requested = resolve(value);
  let existing = requested;
  const missing: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) throw new Error(`${label} could not be resolved`);
    missing.unshift(existing.slice(parent.length + 1));
    existing = parent;
  }

  const canonicalExisting = realpathSync(existing);
  const canonical = missing.reduce(
    (path, segment) => resolve(path, segment),
    canonicalExisting,
  );
  return canonical;
}

function assertWithinProject(
  projectPath: string,
  candidate: string,
  label: string,
) {
  const pathRelative = relative(projectPath, candidate);
  if (
    pathRelative === ".." ||
    pathRelative.startsWith(`..${sep}`) ||
    isAbsolute(pathRelative)
  )
    throw new Error(`${label} must be within projectPath`);
}

function addValues(
  args: string[],
  flag: string,
  values: readonly string[] | undefined,
) {
  for (const value of values ?? []) {
    if (!value || value.startsWith("-"))
      throw new Error(`${flag} values must not be empty or begin with '-'`);
    args.push(flag, value);
  }
}

function addValue(args: string[], flag: string, value: string | undefined) {
  if (value !== undefined) {
    if (!value || value.startsWith("-"))
      throw new Error(`${flag} value must not be empty or begin with '-'`);
    args.push(flag, value);
  }
}

function assertCommandOptions(request: DbtCommandRequest) {
  if (!(request.command in commandFlags))
    throw new Error(`Unknown dbt command: ${String(request.command)}`);
  const knownKeys = new Set([
    "command",
    "projectPath",
    "cwd",
    "profilesDir",
    "profile",
    "target",
    "targetPath",
    "executable",
    "select",
    "exclude",
    "vars",
    "fullRefresh",
    "defer",
    "state",
    "failFast",
    "threads",
    "environment",
  ]);
  for (const key of Object.keys(request))
    if (!knownKeys.has(key)) throw new Error(`Unknown dbt option: ${key}`);

  const supported = new Set(commandFlags[request.command]);
  for (const key of [
    "select",
    "exclude",
    "vars",
    "fullRefresh",
    "defer",
    "state",
    "failFast",
    "threads",
  ] as const) {
    if (request[key] !== undefined && !supported.has(key))
      throw new Error(
        `Option ${key} is not allowed for dbt ${request.command}`,
      );
  }
}

export function planDbtCommand(
  request: DbtCommandRequest,
  options: { readonly allowedExecutables?: readonly string[] } = {},
): DbtCommandPlan {
  assertCommandOptions(request);
  const executable = request.executable ?? "dbt";
  const allowedExecutables = options.allowedExecutables ?? ["dbt"];
  if (!allowedExecutables.includes(executable))
    throw new Error(`Executable is not allowed: ${executable}`);

  const projectPath = canonicalPath(request.projectPath, "projectPath");
  if (!statSync(projectPath).isDirectory())
    throw new Error("projectPath must be a directory");
  const cwd = canonicalPath(request.cwd ?? projectPath, "cwd");
  assertWithinProject(projectPath, cwd, "cwd");

  const profilesDir = request.profilesDir
    ? canonicalPath(request.profilesDir, "profilesDir")
    : undefined;
  const targetPath = request.targetPath
    ? canonicalPath(request.targetPath, "targetPath")
    : undefined;
  if (targetPath) assertWithinProject(projectPath, targetPath, "targetPath");
  const state = request.state
    ? canonicalPath(request.state, "state")
    : undefined;
  if (state) assertWithinProject(projectPath, state, "state");

  const args = [
    request.command === "docs-generate" ? "docs" : request.command,
    ...(request.command === "docs-generate" ? ["generate"] : []),
    "--project-dir",
    projectPath,
  ];
  if (profilesDir) args.push("--profiles-dir", profilesDir);
  addValue(args, "--profile", request.profile);
  addValue(args, "--target", request.target);
  if (targetPath) args.push("--target-path", targetPath);
  addValues(args, "--select", request.select);
  addValues(args, "--exclude", request.exclude);
  if (request.vars) args.push("--vars", JSON.stringify(request.vars));
  if (request.fullRefresh) args.push("--full-refresh");
  if (request.defer) args.push("--defer");
  if (state) args.push("--state", state);
  if (request.failFast) args.push("--fail-fast");
  if (request.threads !== undefined) {
    if (!Number.isInteger(request.threads) || request.threads < 1)
      throw new Error("threads must be a positive integer");
    args.push("--threads", String(request.threads));
  }

  return { command: executable, args, cwd };
}

async function resolveEnvironment(
  environment: DbtCommandRequest["environment"],
  resolver: DbtSecretResolver,
) {
  const resolved: Record<string, string> = {};
  const sensitiveValues: string[] = [];
  for (const [name, entry] of Object.entries(environment ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      throw new Error(`Invalid environment variable name: ${name}`);
    if ("secretRef" in entry && entry.secretRef) {
      const value = await resolver.resolve(entry.secretRef);
      resolved[name] = value;
      if (value) sensitiveValues.push(value);
    } else if (entry.value !== undefined) resolved[name] = entry.value;
    else throw new Error(`Environment variable ${name} has no value`);
  }
  return { resolved, sensitiveValues };
}

function redactOutput(text: string, sensitiveValues: readonly string[]) {
  return sensitiveValues.reduce(
    (result, value) =>
      value ? result.split(value).join("[REDACTED]") : result,
    text,
  );
}

export function createDbtLocalExecutor(
  dependencies: DbtLocalExecutionDependencies,
): DbtLocalExecutor {
  return {
    async execute(request, signal, options) {
      const plan = planDbtCommand(request, {
        allowedExecutables: dependencies.allowedExecutables,
      });
      const { resolved, sensitiveValues } = await resolveEnvironment(
        request.environment,
        dependencies.secretResolver,
      );
      const result = await dependencies.runner.run({
        command: plan.command,
        args: plan.args,
        cwd: plan.cwd,
        env: resolved,
        sensitiveValues,
        signal,
        timeoutMs: options?.timeoutMs,
        onOutput: options?.onOutput,
      });
      return {
        ...result,
        stdout: redactOutput(result.stdout, sensitiveValues),
        stderr: redactOutput(result.stderr, sensitiveValues),
      };
    },
  };
}
