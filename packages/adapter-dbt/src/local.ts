import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DbtLocalConfig } from "./context.js";

export type DbtLocalCommand =
  | "run"
  | "build"
  | "test"
  | "compile"
  | "docs-generate";

export interface DbtLocalExecution {
  readonly command: DbtLocalCommand;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export interface DbtLocalClient {
  version(signal?: AbortSignal): Promise<string>;
  execute(
    command: DbtLocalCommand,
    options: {
      readonly select?: string;
      readonly target?: string;
      readonly fullRefresh?: boolean;
    },
    signal?: AbortSignal,
  ): Promise<DbtLocalExecution>;
}

const maxOutputBytes = 2 * 1024 * 1024;

function runProcess(
  config: DbtLocalConfig,
  args: string[],
  signal: AbortSignal | undefined,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(config.executable, args, {
      cwd: config.projectPath,
      env: {
        ...process.env,
        ...(config.profilesDir ? { DBT_PROFILES_DIR: config.profilesDir } : {}),
      },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const abort = () => child.kill("SIGTERM");
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const append = (current: string, chunk: Buffer) =>
      `${current}${chunk.toString("utf8")}`.slice(-maxOutputBytes);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (exitCode) =>
      finish(() =>
        signal?.aborted
          ? reject(new DOMException("dbt process was cancelled", "AbortError"))
          : resolve({
              exitCode: exitCode ?? 1,
              stdout,
              stderr,
              durationMs: Date.now() - startedAt,
            }),
      ),
    );
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

function commandArgs(
  config: DbtLocalConfig,
  command: DbtLocalCommand,
  options: Parameters<DbtLocalClient["execute"]>[1],
): string[] {
  const args = command === "docs-generate" ? ["docs", "generate"] : [command];
  if (options.select) args.push("--select", options.select);
  if (options.target) args.push("--target", options.target);
  if (options.fullRefresh) args.push("--full-refresh");
  if (config.profilesDir) args.push("--profiles-dir", config.profilesDir);
  return args;
}

export function createDbtLocalClient(config: DbtLocalConfig): DbtLocalClient {
  return {
    async version(signal) {
      const result = await runProcess(config, ["--version"], signal);
      if (result.exitCode !== 0)
        throw new Error(result.stderr || "Could not determine dbt version");
      return result.stdout.trim();
    },
    async execute(command, options, signal) {
      const result = await runProcess(
        config,
        commandArgs(config, command, options),
        signal,
      );
      const targetDirectory = join(
        config.projectPath,
        config.targetPath ?? "target",
      );
      await mkdir(targetDirectory, { recursive: true });
      await writeFile(
        join(targetDirectory, "dsui-last-run.log"),
        [
          `Command: dbt ${command}`,
          `Exit code: ${result.exitCode}`,
          `Duration: ${result.durationMs}ms`,
          "",
          result.stdout ? "STDOUT" : "",
          result.stdout,
          result.stderr ? "STDERR" : "",
          result.stderr,
        ]
          .filter((line) => line !== "")
          .join("\n"),
        "utf8",
      );
      return { command, ...result };
    },
  };
}
