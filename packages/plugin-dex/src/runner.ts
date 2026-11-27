import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { PluginRequestError } from "@northgraindata/dsui-plugin-sdk";
import type { DexConfig, DexProject } from "./config.js";
import { type DexEnvelope, DexOutputError, parseEnvelope } from "./envelope.js";

const MAX_STDOUT_BYTES = 4 * 1024 * 1024;

/**
 * The host variables Dex gets. DSUI's own environment holds secrets, so nothing
 * else passes unless `passEnv` names it. `HOME` is needed for warehouse
 * credential files, which Dex can therefore read.
 */
const BASE_ENV = ["PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR"];

export function dexEnvironment(
  passEnv: readonly string[],
  source: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const environment: Record<string, string> = {
    // Dex ships dbt, which reports anonymous usage unless told otherwise.
    DO_NOT_TRACK: "1",
    DBT_SEND_ANONYMOUS_USAGE_STATS: "false",
  };
  for (const name of [...BASE_ENV, ...passEnv]) {
    const value = source[name];
    if (value !== undefined) environment[name] = value;
  }
  return environment;
}

/** Resolves a configured project on every use, so a moved link cannot redirect Dex. */
export async function resolveProjectRoot(project: DexProject): Promise<string> {
  let root: string;
  let configFile: string;
  try {
    root = await realpath(project.path);
    configFile = await realpath(join(root, ".dex", "config.yml"));
  } catch {
    throw new PluginRequestError(
      `Dex project "${project.id}" needs a directory containing .dex/config.yml`,
      422,
    );
  }
  // Without this, `.dex` could link to another project's configuration.
  if (
    !configFile.startsWith(`${root}${sep}`) ||
    !(await stat(root)).isDirectory()
  )
    throw new PluginRequestError(
      `Dex project "${project.id}" has a .dex/config.yml outside the project`,
      422,
    );
  return root;
}

function execute(
  executable: string,
  args: readonly string[],
  options: {
    cwd: string;
    env: Record<string, string>;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      // Its own process group, so stopping Dex also stops the dbt it starts.
      detached: true,
      // Dex diagnostics can quote local paths and are never shown.
      stdio: ["ignore", "pipe", "ignore"],
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let failure: DexOutputError | undefined;
    const stop = (message: string) => {
      failure ??= new DexOutputError(message);
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // The group already exited.
      }
    };
    const timer = setTimeout(
      () => stop("Dex took too long and was stopped"),
      options.timeoutMs,
    );
    const abort = () => stop("Dex was stopped before it finished");
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    const settle = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      // Truncated JSON is useless, so oversized output fails the whole run.
      if (size > MAX_STDOUT_BYTES) stop("Dex printed too much output");
      else chunks.push(chunk);
    });
    child.once("error", () => {
      settle();
      reject(new DexOutputError("Could not start the Dex executable"));
    });
    child.once("close", () => {
      settle();
      if (failure) reject(failure);
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

export type DexRun = {
  readonly root: string;
  readonly envelope: DexEnvelope;
};

/**
 * One Dex command at a time per project directory.
 *
 * A second caller is refused rather than queued. This does not cover another
 * DSUI process or `dex` run from a terminal.
 */
export function createRunner() {
  const busy = new Set<string>();
  return async function run(
    config: DexConfig,
    project: DexProject,
    command: readonly string[],
    signal?: AbortSignal,
  ): Promise<DexRun> {
    const root = await resolveProjectRoot(project);
    if (busy.has(root))
      throw new PluginRequestError(
        `Dex is already running for project "${project.id}"`,
        409,
      );
    busy.add(root);
    try {
      // The exit code is ignored: Dex exits 1 on an error but still prints
      // the envelope that explains it.
      const stdout = await execute(
        config.executable,
        [...command, "--repo-root", root],
        {
          cwd: root,
          env: dexEnvironment(config.passEnv, process.env),
          timeoutMs: config.commandTimeoutMs,
          ...(signal ? { signal } : {}),
        },
      );
      return { root, envelope: parseEnvelope(stdout) };
    } finally {
      busy.delete(root);
    }
  };
}

export type DexRunner = ReturnType<typeof createRunner>;
