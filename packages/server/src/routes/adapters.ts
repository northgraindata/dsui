import { readFile } from "node:fs/promises";
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
    components: adapter.catalog.components.map((component) => ({
      id: component.id,
      path: component.path,
    })),
    ...(adapter.browserBundlePath
      ? {
          browserComponentsUrl: `/api/v1/adapters/${adapter.id}/components.mjs`,
        }
      : {}),
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

  app.get("/api/v1/adapters/:id/components.mjs", async (context) => {
    const adapter = deps.registry.get(context.req.param("id"));
    if (!adapter.browserBundlePath)
      return context.json(
        { message: "Adapter has no browser components" },
        404,
      );
    const bytes = await readFile(adapter.browserBundlePath);
    return new Response(bytes, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  });
}
