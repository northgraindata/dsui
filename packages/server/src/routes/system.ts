import { existsSync } from "node:fs";
import type { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { PluginRuntime } from "../plugins/runtime.js";
import { DSUI_VERSION } from "../version.js";
import { ADAPTER_ROUTE_PREFIX } from "./adapter-routes.js";

const SERVER_PATHS = ["/api/", `${ADAPTER_ROUTE_PREFIX}/`];

export function registerSystemRoutes(
  app: Hono,
  deps: { pluginRuntime?: PluginRuntime; webRoot?: string },
): void {
  app.get("/health", (context) =>
    context.json({ status: "ok", version: DSUI_VERSION }),
  );
  // `authMode` is retained as a coarse signal for clients that gate the login
  // UI on it: it reports whether an identity plugin is active, not how
  // authentication was performed.
  app.get("/api/v1/health", (context) =>
    context.json({
      status: "ok",
      authMode: deps.pluginRuntime?.hasAuthentication() ? "plugin" : "none",
    }),
  );
  const webRoot = deps.webRoot ?? process.env.DSUI_WEB_ROOT;
  if (webRoot && existsSync(webRoot)) {
    app.use("/*", serveStatic({ root: webRoot }));
    const index = serveStatic({ root: webRoot, path: "index.html" });
    // Paths the server answers itself must not fall through to the web app.
    app.get("*", (context, next) =>
      SERVER_PATHS.some((prefix) => context.req.path.startsWith(prefix))
        ? next()
        : index(context, next),
    );
  }
}
