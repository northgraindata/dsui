import type { Hono } from "hono";
import type { PluginRuntime } from "../plugins/runtime.js";
import type { SignalBus } from "./signal-bus.js";

export function registerEventRoutes(
  app: Hono,
  deps: { bus: SignalBus; runtime: PluginRuntime },
): void {
  app.get("/api/v1/events", async (context) => {
    if (!(await deps.runtime.authorize(context.get("principal"), "inspect")))
      return context.json({ message: "Insufficient permission" }, 403);
    const limitRaw = context.req.query("limit");
    const limit = limitRaw === undefined ? 100 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      return context.json({ message: "limit must be between 1 and 500" }, 400);
    const after = context.req.query("after");
    if (after && Number.isNaN(Date.parse(after)))
      return context.json({ message: "after must be an ISO timestamp" }, 400);
    const items = deps.bus.list({
      ...(after ? { after } : {}),
      ...(context.req.query("serviceId")
        ? { serviceId: context.req.query("serviceId") }
        : {}),
      ...(context.req.query("signalId")
        ? { signalId: context.req.query("signalId") }
        : {}),
      limit,
    });
    return context.json({ items });
  });
}
