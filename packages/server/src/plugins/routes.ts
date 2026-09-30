import type { Hono } from "hono";
import { allowed } from "../auth.js";
import type { PluginRuntime } from "./runtime.js";

export function registerPluginRoutes(
  app: Hono,
  deps: {
    runtime: PluginRuntime;
    audit(actor: string, action: string, target: string): void;
  },
): void {
  app.get("/api/v1/plugins", (context) => context.json(deps.runtime.catalog()));

  app.post(
    "/api/v1/plugins/:pluginId/procedures/:procedureId",
    async (context) => {
      const principal = context.get("principal");
      const pluginId = context.req.param("pluginId");
      const procedureId = context.req.param("procedureId");
      const binding = deps.runtime.procedure(pluginId, procedureId);
      if (!binding)
        return context.json({ message: "Plugin procedure not found" }, 404);
      if (!allowed(principal, binding.procedure.permission))
        return context.json({ message: "Insufficient permission" }, 403);

      let input: unknown;
      try {
        input = await context.req.json();
      } catch {
        return context.json(
          { message: "Request body must be valid JSON" },
          400,
        );
      }

      try {
        const data = await binding.procedure.invoke(input);
        deps.audit(
          principal.id,
          "plugin.procedure.execute",
          `${pluginId}.${procedureId}`,
        );
        return context.json({ data });
      } catch (error) {
        return context.json(
          {
            message:
              error instanceof Error && error.name === "ZodError"
                ? "Plugin procedure input or output is invalid"
                : "Plugin procedure failed",
          },
          error instanceof Error && error.name === "ZodError" ? 422 : 500,
        );
      }
    },
  );
}
