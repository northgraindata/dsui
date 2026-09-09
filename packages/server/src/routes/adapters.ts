import type { PublicAdapter } from "@northgraindata/dsui-core";
import type { Hono } from "hono";
import type { AdapterRegistry } from "../adapters/registry.js";
import type { AdapterReadiness, LoadedAdapter } from "../adapters/types.js";

export function publicAdapterPayload(
  adapter: LoadedAdapter,
  readiness?: AdapterReadiness,
): PublicAdapter {
  return {
    id: adapter.id,
    name: adapter.metadata.name,
    description: adapter.metadata.description ?? "",
    ...(adapter.metadata.iconUrl ? { iconUrl: adapter.metadata.iconUrl } : {}),
    status: readiness?.status ?? "ok",
    ...(readiness?.detail ? { detail: readiness.detail } : {}),
    ...(adapter.connectionSchema
      ? { connectionSchema: adapter.connectionSchema }
      : {}),
    ...(adapter.connectionMethods
      ? { connectionMethods: adapter.connectionMethods }
      : {}),
    resources: adapter.catalog.resources.map((resource) => ({
      id: resource.id,
      ...(resource.inputSchema ? { inputSchema: resource.inputSchema } : {}),
    })),
    actions: adapter.catalog.actions.map((action) => ({
      id: action.id,
      ...(action.inputSchema ? { inputSchema: action.inputSchema } : {}),
    })),
    pages: adapter.catalog.pages.map((page) => ({ path: page.path })),
  };
}

export function registerAdapterRoutes(
  app: Hono,
  deps: {
    registry: AdapterRegistry;
    readiness(): Map<string, AdapterReadiness>;
  },
): void {
  app.get("/api/v1/adapters", (context) =>
    context.json(
      deps.registry
        .list()
        .map((adapter) =>
          publicAdapterPayload(adapter, deps.readiness().get(adapter.id)),
        ),
    ),
  );
}
