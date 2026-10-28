import {
  type AdapterHealthCheck,
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowComponentHealth, AirflowContext } from "./context.js";

/**
 * Fraction of DAGs that may be paused before the scheduler is reported as
 * degraded.
 *
 * Pause rate is a proxy for whether the scheduler is actually advancing
 * work; a deployment where every DAG is paused answers every API call while
 * doing nothing.
 */
const MAX_PAUSED_SHARE = 0.9;

const COMPONENTS: Record<
  AirflowComponentHealth["id"],
  { id: string; label: string; href?: string }
> = {
  metadatabase: { id: "metadatabase", label: "Metadata database" },
  // Not `scheduler`: that id already names the DAG availability check, and
  // changing it would orphan its recorded history.
  scheduler: {
    id: "scheduler-heartbeat",
    label: "Scheduler heartbeat",
    href: "/dags",
  },
  triggerer: { id: "triggerer", label: "Triggerer" },
  "dag-processor": {
    id: "dag-processor",
    label: "DAG processor",
    href: "/dags",
  },
};

/**
 * Adds what Airflow reports about its own components.
 *
 * The REST API can answer while the scheduler is dead, so reachability says
 * little about whether pipelines run. Airflow's health endpoint exposes the
 * heartbeats that do. A deployment that does not expose it is simply not
 * observed here.
 */
async function observeComponents(
  ctx: AirflowContext,
  checks: AdapterHealthCheck[],
): Promise<void> {
  try {
    for (const component of await ctx.client.getHealth()) {
      const described = COMPONENTS[component.id];
      checks.push({
        id: described.id,
        label: described.label,
        ok: component.status === "healthy",
        detail:
          component.status === "healthy" ? "Healthy" : "Reported unhealthy",
        ...(described.href ? { href: described.href } : {}),
      });
    }
  } catch {
    // Not exposed on this deployment or role; leave the checks out.
  }
}

/**
 * Reports the health of an Airflow deployment.
 *
 * Version and DAG enumeration are the two calls that work across both the
 * Airflow 2 (stable REST API, basic auth) and Airflow 3 (JWT) methods, so the
 * health check needs no per-method branching.
 */
export async function airflowHealth(ctx: AirflowContext) {
  const started = Date.now();
  let version: string;
  try {
    version = (await ctx.client.getVersion()).version;
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

  const checks: AdapterHealthCheck[] = [
    reachabilityCheck(true, Date.now() - started),
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

  await observeComponents(ctx, checks);

  return healthReport({
    checks,
    weights: {
      reachability: 1,
      version: 0,
      scheduler: 0.25,
      // A stalled scheduler means nothing runs, even though the API answers.
      "scheduler-heartbeat": 0.5,
      metadatabase: 0.5,
      "dag-processor": 0.3,
      triggerer: 0.15,
    },
    latencyMs: Date.now() - started,
  });
}
