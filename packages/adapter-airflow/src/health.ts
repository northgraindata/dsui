import {
  type AdapterHealthCheck,
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowComponentHealth, AirflowContext } from "./context.js";

const COMPONENTS: Record<
  AirflowComponentHealth["id"],
  { id: string; label: string; href?: string }
> = {
  metadatabase: { id: "metadatabase", label: "Metadata database" },
  // Keep the Airflow-reported scheduler heartbeat distinct from DAG status.
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
 * Authentication and the version endpoint confirm that the deployment is
 * reachable. DAG state and run outcomes belong to Airflow's operational views;
 * they must not lower the infrastructure score.
 */
export async function airflowHealth(ctx: AirflowContext) {
  let version: string;
  let responseMs: number;
  try {
    // Sign-in is required to reach the version endpoint, but its duration is
    // not part of the service response-time measurement.
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

  const checks: AdapterHealthCheck[] = [
    reachabilityCheck(true, responseMs),
    {
      id: "version",
      label: "Airflow version",
      ok: true,
      detail: version,
    },
  ];

  await observeComponents(ctx, checks);

  return healthReport({
    checks,
    weights: {
      reachability: 1,
      version: 0,
      "scheduler-heartbeat": 0.5,
      metadatabase: 0.5,
      "dag-processor": 0.3,
      triggerer: 0.15,
    },
    latencyMs: responseMs,
  });
}
