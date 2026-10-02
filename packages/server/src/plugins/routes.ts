import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Hono } from "hono";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import type { PluginRuntime } from "./runtime.js";

export function registerPluginRoutes(
  app: Hono,
  deps: {
    runtime: PluginRuntime;
    logError?: (pluginId: string, error: unknown) => void;
    audit(actor: string, action: string, target: string): void;
  },
): void {
  app.get("/api/v1/plugins", async (context) => {
    const catalog = deps.runtime.catalog();
    const principal = context.get("principal");
    // An anonymous caller is here to reach a public page — the sign-in screen,
    // most often. It learns which pages exist and nothing else: no plugin
    // names, no versions, no navigation, no slots.
    if (!principal)
      return context.json({
        plugins: [],
        pages: catalog.pages.filter((page) => page.public),
        navigation: [],
        slots: [],
      });
    const visible = new Set<string>();
    for (const plugin of catalog.plugins)
      if (
        await deps.runtime.authorize(principal, "inspect", {
          type: "plugin",
          id: plugin.id,
        })
      )
        visible.add(plugin.id);
    return context.json({
      plugins: catalog.plugins.filter((plugin) => visible.has(plugin.id)),
      pages: catalog.pages.filter((page) => visible.has(page.pluginId)),
      navigation: catalog.navigation.filter((item) =>
        visible.has(item.pluginId),
      ),
      slots: catalog.slots.filter((item) => visible.has(item.pluginId)),
    });
  });

  app.get("/api/v1/plugins/:pluginId/components.mjs", async (context) => {
    const pluginId = context.req.param("pluginId");
    if (
      !deps.runtime.browserBundleIsPublic(pluginId) &&
      !(await deps.runtime.authorize(context.get("principal"), "inspect", {
        type: "plugin",
        id: pluginId,
      }))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    const bundle = deps.runtime.browserBundle(pluginId);
    if (!bundle)
      return context.json({ message: "Plugin bundle not found" }, 404);
    try {
      if ((await stat(bundle.path)).size > 5 * 1024 * 1024)
        return context.json(
          { message: "Plugin browser bundle exceeds size limit" },
          503,
        );
      const bytes = await readFile(bundle.path);
      if (
        bundle.sha256 &&
        createHash("sha256").update(bytes).digest("hex") !== bundle.sha256
      )
        return context.json(
          { message: "Plugin browser bundle integrity mismatch" },
          503,
        );
      return new Response(bytes, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "x-content-type-options": "nosniff",
          "cache-control": "private, max-age=0, must-revalidate",
        },
      });
    } catch {
      return context.json({ message: "Plugin bundle unavailable" }, 503);
    }
  });

  app.post("/api/v1/plugins/slots/:slot", async (context) => {
    if (!(await deps.runtime.authorize(context.get("principal"), "inspect")))
      return context.json({ message: "Insufficient permission" }, 403);
    const inputSchema = z
      .object({ serviceIds: z.array(z.string().min(1)).max(100) })
      .strict();
    const parsed = inputSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success)
      return context.json({ message: "Invalid slot request" }, 422);
    const slot = context.req.param("slot");
    if (
      slot !== "dashboard.service-card.trailing" &&
      slot !== "service.workspace.after-header"
    )
      return context.json({ message: "Unknown plugin slot" }, 404);
    const contributions = deps.runtime
      .catalog()
      .slots.filter((item) => item.slot === slot);
    const result = [];
    for (const id of new Set(parsed.data.serviceIds)) {
      if (
        !(await deps.runtime.authorize(context.get("principal"), "inspect", {
          type: "service",
          id,
        }))
      )
        continue;
      const service = await deps.runtime.withPrincipal(
        context.get("principal"),
        () => deps.runtime.service(id),
      );
      if (!service) continue;
      for (const contribution of contributions) {
        if (
          !(await deps.runtime.authorize(context.get("principal"), "inspect", {
            type: "plugin",
            id: contribution.pluginId,
          }))
        )
          continue;
        try {
          const nodes = await deps.runtime.withPrincipal(
            context.get("principal"),
            () =>
              deps.runtime.renderSlot(contribution.pluginId, contribution.id, {
                service,
              }),
          );
          if (nodes)
            result.push({
              serviceId: id,
              pluginId: contribution.pluginId,
              slotId: contribution.id,
              nodes,
            });
        } catch (error) {
          deps.logError?.(contribution.pluginId, error);
          result.push({
            serviceId: id,
            pluginId: contribution.pluginId,
            slotId: contribution.id,
            nodes: [],
            error: "Plugin widget unavailable",
          });
        }
      }
    }
    return context.json({ items: result });
  });

  app.get("/api/v1/plugins/:pluginId/pages/:pageId", async (context) => {
    const pluginId = context.req.param("pluginId");
    const pageId = context.req.param("pageId");
    // A public page belongs to a security plugin and is the one surface a
    // logged-out browser may reach, so it renders without a principal and
    // without an authorization check. Every other page is authorized as usual.
    const isPublic = deps.runtime.pageIsPublic(pluginId, pageId);
    if (
      !isPublic &&
      !(await deps.runtime.authorize(context.get("principal"), "inspect", {
        type: "plugin",
        id: pluginId,
      }))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const page = isPublic
        ? await deps.runtime.renderPage(pluginId, pageId, context.req.query())
        : await deps.runtime.withPrincipal(context.get("principal"), () =>
            deps.runtime.renderPage(pluginId, pageId, context.req.query()),
          );
      if (!page) return context.json({ message: "Plugin page not found" }, 404);
      return context.json(page);
    } catch (error) {
      // The browser only learns "could not be rendered", which names no cause.
      // Logged so a broken page is diagnosable from the server side.
      console.error("Plugin page render failed", error);
      return context.json(
        { message: "Plugin page could not be rendered" },
        500,
      );
    }
  });

  app.post(
    "/api/v1/plugins/:pluginId/procedures/:procedureId",
    async (context) => {
      const principal = context.get("principal");
      const pluginId = context.req.param("pluginId");
      const procedureId = context.req.param("procedureId");
      const binding = deps.runtime.procedure(pluginId, procedureId);
      if (!binding)
        return context.json({ message: "Plugin procedure not found" }, 404);
      if (
        !(await deps.runtime.authorize(
          principal,
          binding.procedure.permission,
          { type: "plugin", id: pluginId },
        ))
      )
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
        const data = await deps.runtime.withPrincipal(principal, () =>
          Promise.resolve(binding.procedure.invoke(input)),
        );
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

  app.get("/api/v1/plugins/:pluginId/resources", async (context) => {
    const pluginId = context.req.param("pluginId");
    if (
      !(await deps.runtime.authorize(context.get("principal"), "inspect", {
        type: "plugin",
        id: pluginId,
      }))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    const resources = deps.runtime.resources(pluginId);
    return context.json({
      resources: resources.map((resource) => ({
        id: resource.id,
        inputSchema: jsonSchemaOf(resource.input, `resource "${resource.id}"`),
        refresh: { ...resource.refresh },
      })),
    });
  });

  app.post(
    "/api/v1/plugins/:pluginId/resources/:resourceId",
    async (context) => {
      const principal = context.get("principal");
      const pluginId = context.req.param("pluginId");
      const resourceId = context.req.param("resourceId");
      const resource = deps.runtime
        .resources(pluginId)
        .find((item) => item.id === resourceId);
      if (!resource)
        return context.json({ message: "Plugin resource not found" }, 404);
      if (
        !(await deps.runtime.authorize(principal, "inspect", {
          type: "plugin",
          id: pluginId,
        }))
      )
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
        const data = await deps.runtime.withPrincipal(principal, () =>
          Promise.resolve(resource.invoke(input)),
        );
        return context.json({ data });
      } catch (error) {
        return context.json(
          {
            message:
              error instanceof Error && error.name === "ZodError"
                ? "Plugin resource input is invalid"
                : "Plugin resource failed",
          },
          error instanceof Error && error.name === "ZodError" ? 422 : 500,
        );
      }
    },
  );
}

/** Converts a Zod schema to JSON Schema, or `undefined` when absent. */
function jsonSchemaOf(schema: unknown, what: string): unknown {
  if (!schema || typeof schema !== "object") return undefined;
  try {
    return zodToJsonSchema(schema as Parameters<typeof zodToJsonSchema>[0]);
  } catch {
    throw new Error(`Cannot convert ${what} to JSON Schema`);
  }
}
