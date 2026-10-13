import type { Hono } from "hono";
import { AdapterExecutionError } from "../adapters/types.js";
import { allowed } from "../auth.js";
import { errorMessage, httpStatus } from "./errors.js";
import {
  executeServiceAction,
  queryServiceResource,
  type ServiceDeps,
} from "./services.js";

/** Long-action budget; client disconnect aborts earlier via any(). */
const ACTION_TIMEOUT_MS = 600_000;

function actionSignal(client: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(ACTION_TIMEOUT_MS);
  return client ? AbortSignal.any([client, timeout]) : timeout;
}

/**
 * Resources require inspect, actions require execute. The SDK carries
 * no per-capability authorization metadata, so this convention is the
 * contract: reads inspect, mutations execute.
 */
export function registerExecuteRoutes(
  app: Hono,
  deps: ServiceDeps & {
    audit(
      actor: string,
      action: string,
      target: string,
      metadata?: Record<string, unknown>,
    ): void;
  },
): void {
  app.post("/api/v1/services/:id/resources/:resourceId", async (context) => {
    const principal = context.get("principal");
    if (
      !allowed(principal, "inspect") ||
      (deps.pluginRuntime &&
        !(await deps.pluginRuntime.authorize(principal, "inspect", {
          type: "service",
          id: context.req.param("id"),
        })))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const body = (await context.req.json().catch(() => ({}))) as {
        input?: unknown;
      };
      const result = await queryServiceResource(
        deps,
        context.req.param("id"),
        context.req.param("resourceId"),
        body.input,
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof AdapterExecutionError)
        return context.json({ message: error.message }, 502);
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.post("/api/v1/services/:id/actions/:actionId", async (context) => {
    const principal = context.get("principal");
    if (
      !allowed(principal, "execute") ||
      (deps.pluginRuntime &&
        !(await deps.pluginRuntime.authorize(principal, "execute", {
          type: "service",
          id: context.req.param("id"),
          actionId: context.req.param("actionId"),
        })))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const body = (await context.req.json().catch(() => ({}))) as {
        input?: unknown;
      };
      const result = await executeServiceAction(
        deps,
        context.req.param("id"),
        context.req.param("actionId"),
        body.input,
        actionSignal(context.req.raw.signal),
        principal.id,
      );
      return context.json(result.result);
    } catch (error) {
      if (error instanceof AdapterExecutionError)
        return context.json({ message: error.message }, 502);
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });
}
