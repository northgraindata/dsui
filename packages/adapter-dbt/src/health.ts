import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext } from "./context.js";

/**
 * Reports the health of a dbt service.
 *
 * dbt Cloud and a local dbt project are not two configurations of one
 * service; they are two different systems with different failure modes.
 * Cloud health is about an account reachable over HTTP, while local health is
 * about files on the DSUI host and a working dbt executable. Reporting either
 * with the other's signals would produce confident nonsense, so the checks
 * branch on the configured connection method.
 */
export async function dbtHealth(ctx: DbtContext) {
  const started = Date.now();
  if (ctx.config.method === "cloud" && ctx.cloud)
    return cloudHealth(ctx, started);
  return localHealth(ctx, started);
}

/**
 * dbt Cloud: account reachability plus run failures.
 *
 * Recent failures matter because a dbt Cloud account answers every request
 * while its pipelines are broken; reachability alone would report a project
 * whose last fifty runs failed as perfectly healthy.
 */
async function cloudHealth(ctx: DbtContext, started: number) {
  const cloud = ctx.cloud;
  if (!cloud)
    return healthReport({
      checks: [
        { ...reachabilityCheck(false), detail: "dbt Cloud is not configured" },
      ],
      weights: { reachability: 1 },
    });
  try {
    const account = await cloud.getAccount();
    const checks = [
      reachabilityCheck(true, Date.now() - started),
      {
        id: "account",
        label: "Account",
        ok: true,
        detail: `Account ${account.name ?? account.id}`,
      },
    ];

    try {
      const runs = await cloud.listRuns();
      const failed = runs.filter((run) => run.status === "error").length;
      const recent = runs.slice(0, 20);
      checks.push({
        id: "runs",
        label: "Recent runs",
        ok: failed === 0,
        detail: `${failed} failed of ${recent.length} recent runs`,
      });
    } catch (error) {
      checks.push({
        id: "runs",
        label: "Recent runs",
        ok: true,
        detail: `Not observable: ${
          error instanceof Error ? error.message : "permission denied"
        }`,
      });
    }

    return healthReport({
      checks,
      weights: {
        reachability: 1,
        account: 0,
        // A failing pipeline degrades the service without making it
        // unreachable.
        runs: 0.25,
      },
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail:
            error instanceof Error ? error.message : "dbt Cloud unreachable",
        },
      ],
      weights: { reachability: 1 },
    });
  }
}

/**
 * Local dbt: project files on disk and a working executable.
 *
 * There is no service to reach, so the signals are filesystem existence and
 * whether the configured `dbt` binary runs at all.
 */
async function localHealth(ctx: DbtContext, started: number) {
  const config = ctx.config;
  if (config.method !== "local" || !ctx.local)
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail: "dbt connection is not configured",
        },
      ],
      weights: { reachability: 1 },
    });

  const checks = [];

  let version: string;
  try {
    version = await ctx.local.version();
    checks.push({
      id: "executable",
      label: "dbt executable",
      ok: true,
      detail: version,
    });
  } catch (error) {
    return healthReport({
      checks: [
        {
          id: "executable",
          label: "dbt executable",
          ok: false,
          detail:
            error instanceof Error
              ? error.message
              : `"${config.executable}" could not be run`,
        },
      ],
      weights: { executable: 1 },
      latencyMs: Date.now() - started,
    });
  }

  try {
    await access(config.projectPath);
    const info = await stat(config.projectPath);
    checks.push({
      id: "project",
      label: "Project directory",
      ok: info.isDirectory(),
      detail: info.isDirectory()
        ? config.projectPath
        : `${config.projectPath} is not a directory`,
    });
  } catch (error) {
    checks.push({
      id: "project",
      label: "Project directory",
      ok: false,
      detail:
        error instanceof Error
          ? `Unreachable: ${error.message}`
          : `Unreachable: ${config.projectPath}`,
    });
  }

  if (config.profilesDir) {
    try {
      await access(join(config.profilesDir, "profiles.yml"));
      checks.push({
        id: "profiles",
        label: "profiles.yml",
        ok: true,
        detail: config.profilesDir,
      });
    } catch {
      checks.push({
        id: "profiles",
        label: "profiles.yml",
        ok: false,
        detail: `Not found in ${config.profilesDir}`,
      });
    }
  }

  const score = healthReport({ checks, weights: {}, latencyMs: 0 }).score;
  const failing = checks.filter((check) => !check.ok);
  return healthReport({
    checks,
    weights: { executable: 1, project: 1, profiles: 0.5 },
    // A local project has no remote latency budget to interpret, so the
    // measured round trip is reported without being judged here.
    latencyMs: Date.now() - started,
    status:
      failing.length === 0
        ? "healthy"
        : score >= 60
          ? "warning"
          : "unavailable",
  });
}
