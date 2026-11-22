import {
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "./context.js";

/**
 * Fraction of DAGs that may be paused before the scheduler is reported as
 * degraded.
 *
 * Pause rate is a proxy for whether the scheduler is actually advancing
 * work; a deployment where every DAG is paused answers every API call while
 * doing nothing.
 */
const MAX_PAUSED_SHARE = 0.9;

/**
 * Reports the health of an Airflow deployment.
 *
 * Version and DAG enumeration are the two calls that work across both the
 * Airflow 2 (stable REST API, basic auth) and Airflow 3 (JWT) methods, so the
 * health check needs no per-method branching.
 */
export async function airflowHealth(ctx: AirflowContext) {
  let version: string;
  let responseMs: number;
  try {
    // Signing in is not Airflow answering, so it happens before the clock
    // starts. The response time is that of one call, not of the whole check:
    // listing every DAG below is a separate, larger request.
    await ctx.client.authenticate();
    const started = Date.now();
    version = (await ctx.client.getVersion()).version;
    responseMs = Date.now() - started;
  } catch (error) {
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail:
            error instanceof Error ? error.message : "Airflow unreachable",
        },
      ],
      weights: { reachability: 1 },
    });
  }

  const checks = [
    reachabilityCheck(true, responseMs),
    {
      id: "version",
      label: "Airflow version",
      ok: true,
      detail: version,
    },
  ];

  try {
    const dags = await ctx.client.listDags();
    const paused = dags.filter((dag) => dag.isPaused).length;
    const share = dags.length === 0 ? 0 : paused / dags.length;
    checks.push({
      id: "scheduler",
      label: "DAG availability",
      ok: dags.length === 0 || share < MAX_PAUSED_SHARE,
      detail:
        dags.length === 0
          ? "No DAGs visible"
          : `${dags.length - paused} of ${dags.length} DAGs active`,
    });
  } catch (error) {
    checks.push({
      id: "scheduler",
      label: "DAG availability",
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
      version: 0,
      scheduler: 0.25,
    },
    latencyMs: responseMs,
  });
}
