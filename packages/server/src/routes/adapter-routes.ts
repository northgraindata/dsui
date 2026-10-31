import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { matchRoute } from "@northgraindata/dsui-adapter-sdk";
import type { Context, Hono } from "hono";
import type { AdapterRegistry } from "../adapters/registry.js";
import type {
  LoadedAdapter,
  RouteCall,
  RouteCatalogEntry,
} from "../adapters/types.js";
import { allowed, LOCAL_PRINCIPAL_ID, type Principal } from "../auth.js";
import { connectionFor, type ServiceDeps, serviceSource } from "./services.js";

/** Where adapter routes are served, outside `/api/v1` so a token caller needs no user session. */
export const ADAPTER_ROUTE_PREFIX = "/adapters/v1/services";

/** Headers an adapter may set on its reply. Everything else is dropped. */
const REPLY_HEADERS = new Set(["content-type", "cache-control", "etag"]);

/** Request headers never handed to an adapter: they carry the caller's credentials. */
const PRIVATE_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
]);

class RouteRejection extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

const reject = (error: RouteRejection, context: Context) =>
  context.json({ message: error.message }, error.status as 401, error.headers);

/** Compares through a digest so neither the length nor a prefix of the secret leaks. */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function bearer(context: Context): string | undefined {
  const header = context.req.header("authorization");
  const match = header ? /^Bearer (.+)$/i.exec(header) : null;
  return match?.[1];
}

function matchedRoute(
  adapter: LoadedAdapter,
  method: string,
  subpath: string,
): { route: RouteCatalogEntry; params: Record<string, string> } | undefined {
  for (const route of adapter.catalog.routes) {
    if (route.method !== method) continue;
    try {
      const params = matchRoute(route.path, subpath);
      if (params) return { route, params };
    } catch {
      // Malformed percent-encoding in the URL matches nothing.
      return undefined;
    }
  }
  return undefined;
}

/**
 * Writes the request body to a file instead of memory.
 *
 * A route may accept hundreds of megabytes; buffering that here and again in
 * the adapter process is avoidable, and a JSON-RPC line cannot carry it.
 * The size is counted as it streams, so a client that lies about
 * `content-length` is still stopped at the limit.
 */
async function spoolBody(
  request: Request,
  limit: number,
  directory: string,
): Promise<string | undefined> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit)
    throw new RouteRejection(413, "Request body is too large");
  if (!request.body) return undefined;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, randomUUID());
  const file = await open(path, "wx", 0o600);
  let size = 0;
  try {
    for await (const chunk of request.body) {
      size += chunk.byteLength;
      if (size > limit)
        throw new RouteRejection(413, "Request body is too large");
      await file.write(chunk);
    }
  } catch (error) {
    await file.close();
    await rm(path, { force: true });
    throw error;
  }
  await file.close();
  return path;
}

export interface AdapterRouteDeps extends ServiceDeps {
  /** Scratch space for request bodies on their way to the adapter host. */
  spoolDirectory: string;
  audit(
    actor: string,
    action: string,
    target: string,
    metadata?: Record<string, unknown>,
  ): void;
}

async function authenticate(
  context: Context,
  deps: AdapterRouteDeps,
  route: RouteCatalogEntry,
  serviceId: string,
  connection: () => Record<string, unknown>,
): Promise<string> {
  if (route.auth === "principal") {
    const runtime = deps.pluginRuntime;
    let principal: Principal | null = {
      id: LOCAL_PRINCIPAL_ID,
      role: "owner",
    };
    if (runtime?.hasAuthentication())
      principal = await runtime.authenticate(context.req.raw).catch(() => null);
    if (!principal) throw new RouteRejection(401, "Authentication required");
    if (
      !allowed(principal, route.permission) ||
      (runtime &&
        !(await runtime.authorize(principal, route.permission, {
          type: "service",
          id: serviceId,
        })))
    )
      throw new RouteRejection(403, "Insufficient permission");
    return principal.id;
  }
  // An unset secret must reject everything, never match an absent header.
  const secret = connection()[route.auth.token];
  const given = bearer(context);
  if (
    typeof secret !== "string" ||
    secret.length === 0 ||
    given === undefined ||
    !sameSecret(given, secret)
  )
    throw new RouteRejection(401, "Unauthorized", {
      "www-authenticate": "Bearer",
    });
  return `route-token:${serviceId}`;
}

/**
 * Serves the HTTP routes adapters declare, one URL space for every adapter:
 * `/adapters/v1/services/:serviceId<route path>`.
 *
 * The host owns everything that must not differ between adapters:
 * authentication, body limits, timeouts, audit, signal delivery and what an
 * adapter is allowed to put in a reply. A handler only sees an
 * authenticated, size-limited request.
 */
export function registerAdapterRouteEndpoints(
  app: Hono,
  deps: AdapterRouteDeps,
): void {
  app.all(`${ADAPTER_ROUTE_PREFIX}/:serviceId/*`, async (context) => {
    const serviceId = context.req.param("serviceId");
    const prefix = `${ADAPTER_ROUTE_PREFIX}/${serviceId}`;
    const subpath = new URL(context.req.url).pathname.slice(prefix.length);
    let bodyPath: string | undefined;
    try {
      await deps.refreshConfig();
      const source = serviceSource(deps.getConfig(), deps.database, serviceId);
      let adapter: LoadedAdapter | undefined;
      try {
        adapter = source
          ? deps.registry.get(source.service.adapter)
          : undefined;
      } catch {
        adapter = undefined;
      }
      const found =
        adapter && matchedRoute(adapter, context.req.method, subpath);
      if (!source || !adapter || !found)
        throw new RouteRejection(404, "Not found");
      const { route, params } = found;

      const actor = await authenticate(context, deps, route, serviceId, () =>
        connectionFor(deps.cipher, source),
      );
      bodyPath = await spoolBody(
        context.req.raw,
        route.maxBodyBytes,
        deps.spoolDirectory,
      );
      const call: RouteCall = {
        method: route.method,
        path: subpath,
        params,
        query: Object.fromEntries(new URL(context.req.url).searchParams),
        headers: Object.fromEntries(
          [...context.req.raw.headers].filter(
            ([name]) => !PRIVATE_HEADERS.has(name),
          ),
        ),
        ...(bodyPath ? { bodyPath } : {}),
      };
      const signal = AbortSignal.any([
        context.req.raw.signal,
        AbortSignal.timeout(route.timeoutMs),
      ]);
      const reply = await adapter.backend.executeRoute(
        route.id,
        connectionFor(deps.cipher, source),
        call,
        { signal, timeoutMs: route.timeoutMs },
        { persistenceNamespace: serviceId },
      );
      for (const emission of reply.emissions) {
        const declared = adapter.catalog.signals.find(
          (candidate) => candidate.id === emission.signalId,
        );
        if (!declared)
          throw new Error(
            `Adapter route emitted undeclared signal "${emission.signalId}"`,
          );
        deps.signalBus.publish({
          signalId: `${adapter.id}.${emission.signalId}`,
          type: declared.type,
          sourceType: "adapter",
          sourceId: serviceId,
          serviceId,
          payload: emission.payload,
          ...(emission.idempotencyKey
            ? { idempotencyKey: emission.idempotencyKey }
            : {}),
        });
      }
      deps.audit(actor, "route.call", serviceId, {
        route: route.id,
        status: reply.status,
      });
      // An adapter's reply is served from DSUI's own origin, so it must not be
      // able to run script there or set cookies for it.
      const headers = new Headers({
        "content-security-policy": "default-src 'none'; sandbox",
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
      });
      for (const [name, value] of Object.entries(reply.headers))
        if (REPLY_HEADERS.has(name.toLowerCase())) headers.set(name, value);
      return new Response(
        reply.status === 204 || reply.status === 304
          ? null
          : reply.body
            ? Buffer.from(reply.body)
            : null,
        { status: reply.status, headers },
      );
    } catch (error) {
      if (error instanceof RouteRejection) return reject(error, context);
      // The adapter's own message can name hosts or paths, so it stays in the log.
      console.error(
        `[adapter-route] ${serviceId}${subpath} failed:`,
        error instanceof Error ? error.message : "unknown error",
      );
      return context.json({ message: "Route failed" }, 500);
    } finally {
      if (bodyPath) await rm(bodyPath, { force: true });
    }
  });
}
