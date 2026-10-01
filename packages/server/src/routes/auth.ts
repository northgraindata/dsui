import type { Hono } from "hono";
import {
  LOCAL_PRINCIPAL_ID,
  localPrincipalMiddleware,
  type Principal,
  type Role,
} from "../auth.js";
import type { PluginRuntime } from "../plugins/runtime.js";

/**
 * Identity endpoints.
 *
 * OSS DSUI has no login. When no authentication plugin is installed every
 * request runs as the local owner principal, and `/me` simply reports that.
 * A plugin that does provide identity owns its own login and callback routes;
 * this module mounts them, asks it to resolve a principal, and exposes the
 * result.
 */

export interface AuthRouteDeps {
  pluginRuntime?: PluginRuntime;
}

/**
 * Mounts the active authentication plugin's own endpoints.
 *
 * These are the routes a logged-out browser has to reach, so they are mounted
 * before the principal middleware and live outside `/api/v1` to keep the two
 * concerns apart: `/api/auth/<pluginId>/*` is what the plugin serves,
 * `/api/v1/*` is what the host protects on the plugin's behalf.
 */
function registerAuthenticationPluginRoutes(
  app: Hono,
  deps: AuthRouteDeps,
): void {
  app.all("/api/auth/:pluginId/*", async (context) => {
    const routes = deps.pluginRuntime?.authenticationRoutes(
      context.req.param("pluginId"),
    );
    if (!routes) return context.json({ message: "Not found" }, 404);
    try {
      return await routes(context.req.raw);
    } catch {
      // The plugin owns this request's failure reporting; the host only avoids
      // leaking an internal error to an unauthenticated caller.
      return context.json({ message: "Authentication request failed" }, 500);
    }
  });
}

/**
 * Resolves the principal for every API request.
 *
 * With an authentication plugin the plugin decides who is calling; without one
 * the local owner principal is assumed. Either way the principal is set on the
 * context so downstream route handlers do not care which case applies.
 */
export function registerAuthMiddleware(app: Hono, deps: AuthRouteDeps): void {
  app.use("/api/v1/*", async (context, next) => {
    const runtime = deps.pluginRuntime;
    if (!runtime?.hasAuthentication())
      return localPrincipalMiddleware()(context, next);
    const { pathname } = new URL(context.req.url);
    // A page a security plugin declared public is the one request an anonymous
    // caller may make. Everything else still needs an identity.
    if (!runtime.requiresPrincipal(pathname)) return next();
    try {
      const principal: Principal | null = await runtime.authenticate(
        context.req.raw,
      );
      if (!principal)
        return context.json({ message: "Authentication required" }, 401);
      context.set("principal", principal);
      return next();
    } catch {
      // A failing authentication provider must deny, never fall back to the
      // permissive local principal.
      return context.json({ message: "Authentication required" }, 401);
    }
  });
}

export function registerAuthRoutes(app: Hono, deps: AuthRouteDeps): void {
  registerAuthenticationPluginRoutes(app, deps);

  /**
   * Where the sign-in screen lives.
   *
   * The web app needs to know which page to show before anyone is signed in,
   * and it must not guess: the answer is whatever the active authentication
   * plugin published. Registered ahead of the middleware for that reason.
   */
  app.get("/api/v1/auth/entry", (context) => {
    const runtime = deps.pluginRuntime;
    const pluginId = runtime?.authenticationPluginId;
    // `hasAuthentication` is true for a failed security plugin too. Saying
    // "none" there would send the web app into the app and straight into a wall
    // of 401s, so report the failure instead.
    if (runtime?.hasAuthentication() && !pluginId)
      return context.json({ mode: "unavailable" });
    if (!runtime?.hasAuthentication() || !pluginId)
      return context.json({ mode: "none" });
    for (const page of runtime.catalog().pages)
      if (page.pluginId === pluginId && page.public)
        return context.json({
          mode: "plugin",
          pluginId,
          pageId: page.id,
          shell: page.shell ?? "app",
        });
    // A plugin that authenticates but publishes no public page has not finished
    // wiring its own sign-in screen; say so rather than redirecting nowhere.
    return context.json({ mode: "plugin", pluginId });
  });

  /**
   * Who the caller is, if anyone.
   *
   * Answers for an anonymous caller rather than rejecting the request: "who am
   * I" is the one question a logged-out browser legitimately asks, and the web
   * app needs a null here to decide whether to show the sign-in screen. With no
   * authentication plugin every request runs as the local owner, so that is
   * what it reports.
   */
  app.get("/api/v1/auth/me", async (context) => {
    const runtime = deps.pluginRuntime;
    if (!runtime?.hasAuthentication())
      return context.json({
        id: LOCAL_PRINCIPAL_ID,
        role: "owner" satisfies Role,
      });
    const principal = await runtime
      .authenticate(context.req.raw)
      .catch(() => null);
    return context.json(principal);
  });

  registerAuthMiddleware(app, deps);
}
