import type { z } from "zod";
import type { BlobStore } from "./blob";
import { InvalidDefinitionError } from "./shared/errors";
import type { AnySignalDefinition } from "./signal";
import type { StoreDefinition, StoreInstance } from "./store";

export type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Who may call a route.
 *
 * - `"principal"`: a signed-in DSUI user. The host resolves the caller the way
 *   it does for the rest of the API, so an authentication plugin applies when
 *   one is installed.
 * - `{ token }`: a machine caller, such as a CI job. `token` names a field of
 *   the service's connection config holding a shared secret; the caller sends
 *   it as `Authorization: Bearer <secret>`. A route is never public: an unset
 *   secret rejects every request.
 */
export type RouteAuth = "principal" | { readonly token: string };

/** What a `principal` caller needs. Defaults to `inspect` for GET and `execute` otherwise. */
export type RoutePermission = "inspect" | "execute";

/** One HTTP request, already authenticated and size-limited by the host. */
export interface RouteRequest {
  readonly method: RouteMethod;
  /** Path below the service, as matched, e.g. `/artifacts`. */
  readonly path: string;
  /** Values of the `:name` segments in the route's path. */
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  /** Lower-cased header names. `authorization` is never passed on. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  text(): string;
  /** Parses the body as JSON; throws a 400 {@link RouteError} when it is not. */
  json(): unknown;
}

export interface RouteResponse {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  /** Kept small: it crosses a process boundary inside one JSON line. */
  readonly body?: string | Uint8Array;
}

/** Throw from a handler to answer with a specific status instead of a 500. */
export class RouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

/** A JSON response. */
export function routeJson(value: unknown, status = 200): RouteResponse {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

export interface RouteHandlerInput<TContext> {
  readonly request: RouteRequest;
  readonly context: TContext;
  readonly signal: AbortSignal;
  /** Persistent adapter-scoped state. */
  readonly store: <
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: StoreDefinition<TState, TActions>,
  ) => StoreInstance<TState, TActions>;
  /** Binary storage private to this service. */
  readonly blobs: BlobStore;
  readonly emit: <TSignal extends AnySignalDefinition>(
    definition: TSignal,
    payload: z.output<TSignal["schema"]>,
    options?: { readonly idempotencyKey?: string },
  ) => void;
}

export interface RouteDefinition<TContext = unknown> {
  readonly kind: "route";
  readonly id: string;
  readonly method: RouteMethod;
  /** Path below the service, with `:name` segments. */
  readonly path: string;
  readonly auth: RouteAuth;
  readonly permission: RoutePermission;
  /** Largest request body the host accepts. */
  readonly maxBodyBytes: number;
  readonly timeoutMs: number;
  readonly handle: (
    input: RouteHandlerInput<TContext>,
  ) => Promise<RouteResponse> | RouteResponse;
}

/** Type-erased route definition used by adapter catalogs. */
export type AnyRouteDefinition<TContext = unknown> = RouteDefinition<TContext>;

export interface DefineRouteOptions<TContext> {
  readonly id: string;
  readonly method: RouteMethod;
  readonly path: string;
  readonly auth: RouteAuth;
  readonly permission?: RoutePermission;
  /** Defaults to 1 MiB. The host also enforces its own ceiling. */
  readonly maxBodyBytes?: number;
  readonly timeoutMs?: number;
  readonly handle: RouteDefinition<TContext>["handle"];
}

export const DEFAULT_ROUTE_BODY_BYTES = 1024 * 1024;
/** Hard ceiling no route can raise: the host buffers a body before handing it over. */
export const MAX_ROUTE_BODY_BYTES = 256 * 1024 * 1024;

const KEBAB = /^[a-z][a-z0-9-]*$/;
const SEGMENT = /^(?:[A-Za-z0-9._~-]+|:[A-Za-z][A-Za-z0-9]*)$/;
const isDotSegment = (segment: string) => /^\.+$/.test(segment);

function validPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  const segments = path.slice(1).split("/");
  return segments.every(
    (segment) => SEGMENT.test(segment) && !isDotSegment(segment),
  );
}
const METHODS: readonly RouteMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

/**
 * Declares an HTTP endpoint served by one configured service.
 *
 * The host mounts it at
 * `/adapters/v1/services/:serviceId<path>`, outside `/api/v1`, so a caller
 * that is not a DSUI user (a CI job, a webhook) can reach it with a token.
 *
 * @example
 * ```ts
 * defineRoute({
 *   id: "receive",
 *   method: "POST",
 *   path: "/events",
 *   auth: { token: "ingestToken" },
 *   handle: async ({ request, blobs }) => {
 *     await blobs.put("last-event.json", request.body);
 *     return routeJson({ ok: true });
 *   },
 * });
 * ```
 */
export function defineRoute<TContext>(
  options: DefineRouteOptions<TContext>,
): RouteDefinition<TContext> {
  if (!KEBAB.test(options.id))
    throw new InvalidDefinitionError(
      `Route id must be kebab-case, found "${options.id}"`,
    );
  if (!METHODS.includes(options.method))
    throw new InvalidDefinitionError(
      `Route "${options.id}" has an unsupported method`,
    );
  if (!validPath(options.path))
    throw new InvalidDefinitionError(
      `Route "${options.id}" path must start with "/" and use plain or :name segments`,
    );
  const names = options.path
    .split("/")
    .filter((segment) => segment.startsWith(":"));
  if (new Set(names).size !== names.length)
    throw new InvalidDefinitionError(
      `Route "${options.id}" repeats a path parameter`,
    );
  if (
    options.auth !== "principal" &&
    (typeof options.auth !== "object" ||
      typeof options.auth.token !== "string" ||
      options.auth.token.length === 0)
  )
    throw new InvalidDefinitionError(
      `Route "${options.id}" auth must be "principal" or { token: <connection field> }`,
    );
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_ROUTE_BODY_BYTES;
  if (
    !Number.isInteger(maxBodyBytes) ||
    maxBodyBytes < 0 ||
    maxBodyBytes > MAX_ROUTE_BODY_BYTES
  )
    throw new InvalidDefinitionError(
      `Route "${options.id}" maxBodyBytes must be an integer between 0 and ${MAX_ROUTE_BODY_BYTES}`,
    );
  const timeoutMs = options.timeoutMs ?? 60_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1)
    throw new InvalidDefinitionError(
      `Route "${options.id}" timeout must be a positive integer`,
    );
  return {
    kind: "route",
    id: options.id,
    method: options.method,
    path: options.path,
    auth: options.auth,
    permission:
      options.permission ?? (options.method === "GET" ? "inspect" : "execute"),
    maxBodyBytes,
    timeoutMs,
    handle: options.handle,
  };
}
