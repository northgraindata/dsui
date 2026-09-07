import type { Hono } from "hono";
import { AdapterExecutionError } from "../adapters/types.js";
import { allowed } from "../auth.js";
import { errorMessage, httpStatus } from "./errors.js";
import { connectionFor, type ServiceDeps, serviceSource } from "./services.js";

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
    if (!allowed(principal, "inspect"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const source = serviceSource(
        deps.getConfig(),
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      const adapter = deps.registry.get(source.service.adapter);
      const body = (await context.req.json().catch(() => ({}))) as {
        input?: unknown;
      };
      const result = await adapter.backend.executeResource(
        context.req.param("resourceId"),
        connectionFor(deps.cipher, source),
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
    if (!allowed(principal, "execute"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const source = serviceSource(
        deps.getConfig(),
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      const adapter = deps.registry.get(source.service.adapter);
      const body = (await context.req.json().catch(() => ({}))) as {
        input?: unknown;
      };
      const result = await adapter.backend.executeAction(
        context.req.param("actionId"),
        connectionFor(deps.cipher, source),
        body.input,
        actionSignal(context.req.raw.signal),
      );
      deps.audit(principal.id, "action.execute", source.service.id, {
        action: context.req.param("actionId"),
      });
      return context.json(result);
    } catch (error) {
      if (error instanceof AdapterExecutionError)
        return context.json({ message: error.message }, 502);
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });
}
