import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { AuthMode } from "../auth.js";
import { DSUI_VERSION } from "../version.js";

export function registerSystemRoutes(
  app: Hono,
  deps: { authMode: AuthMode; webRoot?: string },
): void {
  app.get("/health", (context) =>
    context.json({ status: "ok", version: DSUI_VERSION }),
  );
  app.get("/api/v1/health", (context) =>
    context.json({ status: "ok", authMode: deps.authMode }),
  );
  const webRoot = deps.webRoot ?? process.env.DSUI_WEB_ROOT;
  if (webRoot && existsSync(webRoot)) {
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", serveStatic({ path: join(webRoot, "index.html") }));
  }
}
