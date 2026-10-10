import type { Hono } from "hono";
import { allowed } from "../auth.js";
import type { ServiceDeps } from "../routes/services.js";
import { serviceSource } from "../routes/services.js";
import {
  dashboardModuleGroups,
  dashboardSchema,
  moduleSchema,
} from "./definitions.js";
import { AnalyticsStore } from "./storage.js";

export function registerAnalyticsRoutes(
  app: Hono,
  dataDir: string,
  deps: ServiceDeps,
): void {
  const store = new AnalyticsStore(dataDir);
  const can = async (
    principal: Parameters<typeof allowed>[0],
    permission: "inspect" | "manage",
  ) =>
    allowed(principal, permission) &&
    (!deps.pluginRuntime ||
      (await deps.pluginRuntime.authorize(principal, permission)));
  const canSeeService = async (
    principal: Parameters<typeof allowed>[0],
    serviceId: string,
  ) =>
    allowed(principal, "inspect") &&
    (!deps.pluginRuntime ||
      (await deps.pluginRuntime.authorize(principal, "inspect", {
        type: "service",
        id: serviceId,
      })));
  const visibleModules = async (principal: Parameters<typeof allowed>[0]) => {
    const modules = await store.modules();
    const visible = await Promise.all(
      modules.map(async (module) => ({
        module,
        allowed: await canSeeService(principal, module.source.serviceId),
      })),
    );
    return visible.filter((item) => item.allowed).map((item) => item.module);
  };

  app.get("/api/v1/analytics/modules", async (context) => {
    if (!(await can(context.get("principal"), "inspect")))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      return context.json(await visibleModules(context.get("principal")));
    } catch (error) {
      return context.json({ message: message(error) }, 422);
    }
  });
  app.put("/api/v1/analytics/modules", async (context) => {
    if (!(await can(context.get("principal"), "manage")))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const body = (await context.req.json()) as {
        definition: unknown;
        expectedRevision: string | null;
      };
      if (!("expectedRevision" in body))
        throw new Error("Expected revision is required");
      const definition = moduleSchema.parse(body.definition);
      const principal = context.get("principal");
      if (!(await canSeeService(principal, definition.source.serviceId)))
        return context.json(
          { message: "Insufficient service permission" },
          403,
        );
      await deps.refreshConfig();
      const source = serviceSource(
        deps.getConfig(),
        deps.database,
        definition.source.serviceId,
      );
      if (!source) return context.json({ message: "Service not found" }, 404);
      const adapter = deps.registry.get(source.service.adapter);
      if (
        !adapter.catalog.resources.some(
          (item) => item.id === definition.source.resourceId,
        )
      )
        return context.json({ message: "Resource not found" }, 404);
      return context.json(
        await store.saveModule(definition, body.expectedRevision),
      );
    } catch (error) {
      return context.json({ message: message(error) }, 422);
    }
  });
  app.get("/api/v1/analytics/dashboards", async (context) => {
    const principal = context.get("principal");
    if (!(await can(principal, "inspect")))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const visible = new Set(
        (await visibleModules(principal)).map(
          (module) => `${module.subfolder ?? ""}/${module.name}`,
        ),
      );
      const favorites = new Set(deps.database.dashboardFavorites(principal.id));
      const dashboards = await store.dashboards();
      return context.json(
        dashboards
          .filter((dashboard) =>
            dashboardModuleGroups(dashboard)
              .flat()
              .every((item) =>
                visible.has(`${item.subfolder ?? ""}/${item.module}`),
              ),
          )
          .map((dashboard) => ({
            ...dashboard,
            favorite: favorites.has(dashboard.name),
          })),
      );
    } catch (error) {
      return context.json({ message: message(error) }, 422);
    }
  });
  app.put("/api/v1/analytics/dashboards", async (context) => {
    const principal = context.get("principal");
    if (!(await can(principal, "manage")))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const body = (await context.req.json()) as {
        definition: unknown;
        expectedRevision: string | null;
      };
      if (!("expectedRevision" in body))
        throw new Error("Expected revision is required");
      const parsed = dashboardSchema.parse(body.definition);
      const visible = new Set(
        (await visibleModules(principal)).map(
          (module) => `${module.subfolder ?? ""}/${module.name}`,
        ),
      );
      if (
        dashboardModuleGroups(parsed)
          .flat()
          .some(
            (item) => !visible.has(`${item.subfolder ?? ""}/${item.module}`),
          )
      )
        return context.json({ message: "Module is not available" }, 403);
      return context.json(
        await store.saveDashboard(parsed, body.expectedRevision),
      );
    } catch (error) {
      return context.json({ message: message(error) }, 422);
    }
  });
  app.put("/api/v1/analytics/dashboards/:name/favorite", async (context) => {
    const principal = context.get("principal");
    if (!(await can(principal, "inspect")))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const name = context.req.param("name");
      const body: unknown = await context.req.json();
      if (
        !body ||
        typeof body !== "object" ||
        !("favorite" in body) ||
        typeof body.favorite !== "boolean"
      )
        return context.json({ message: "favorite must be a boolean" }, 422);
      const dashboard = (await store.dashboards()).find(
        (item) => item.name === name,
      );
      if (!dashboard)
        return context.json({ message: "Dashboard not found" }, 404);
      const visible = new Set(
        (await visibleModules(principal)).map(
          (module) => `${module.subfolder ?? ""}/${module.name}`,
        ),
      );
      if (
        !dashboardModuleGroups(dashboard)
          .flat()
          .every((item) =>
            visible.has(`${item.subfolder ?? ""}/${item.module}`),
          )
      )
        return context.json({ message: "Dashboard not found" }, 404);
      deps.database.setDashboardFavorite(principal.id, name, body.favorite);
      return context.json({ favorite: body.favorite });
    } catch (error) {
      return context.json({ message: message(error) }, 422);
    }
  });
  app.get("/api/v1/analytics/resources/:serviceId", async (context) => {
    const principal = context.get("principal");
    const serviceId = context.req.param("serviceId");
    if (
      !(await can(principal, "inspect")) ||
      !(await canSeeService(principal, serviceId))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const source = serviceSource(deps.getConfig(), deps.database, serviceId);
      if (!source) return context.json({ message: "Service not found" }, 404);
      const adapter = deps.registry.get(source.service.adapter);
      return context.json(
        adapter.catalog.resources.map((resource) => ({
          id: resource.id,
          inputSchema: resource.inputSchema,
        })),
      );
    } catch (error) {
      return context.json({ message: message(error) }, 422);
    }
  });
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Invalid analytics definition";
}
