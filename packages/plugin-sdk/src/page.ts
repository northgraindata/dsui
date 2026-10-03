/**
 * Plugin pages, mirroring the adapter SDK's `definePage`.
 *
 * A page is a route plus a render function. Declaring the path as a literal
 * type is what makes route params typed: `"/teams/:teamId"` yields
 * `params.teamId` as a `string`, so a render function cannot read a param the
 * route never carries.
 */
import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { InvalidDefinitionError } from "./shared/errors";

type ExtractParams<Path extends string> = string extends Path
  ? // An unconstrained path carries any param the route may match. A literal
    // path below is checked precisely, so a page read with a param its path
    // never declares is still a compile error.
    Record<string, string>
  : Path extends `${string}:${infer Rest}`
    ? Rest extends `${infer Name}/${infer Tail}`
      ? (Name extends "" ? Record<string, never> : { [K in Name]: string }) &
          ExtractParams<`/${Tail}`>
      : Rest extends ""
        ? Record<string, never>
        : { [K in Rest]: string }
    : Record<string, never>;

/**
 * Route params inferred from a page path.
 *
 * `"/teams/:teamId"` yields `{ teamId: string }`; a static path yields an
 * empty record.
 *
 * @example
 * ```ts
 * type Params = ExtractRouteParams<"/teams/:teamId">;
 * // { teamId: string }
 * ```
 */
export type ExtractRouteParams<Path extends string> = ExtractParams<Path>;

/** Reads a declared resource's data. */
export type PluginResourceReader = <TOutput>(
  definition: PluginResourceLike<TOutput>,
  input?: unknown,
) => TOutput | Promise<TOutput>;

/** Context every page render receives. */
export type PluginPageContext<TConfig = unknown> = {
  /** The plugin's own context: config, services, storage, stores, logger. */
  readonly context: TConfig;
  /**
   * Reads a declared resource. The host re-runs the query on the resource's
   * refresh policy, so `refresh: poll("5s")` keeps a page current without the
   * render function doing anything.
   */
  readonly resource: PluginResourceReader;
};

/** Minimal shape a resource must satisfy to be read from a page. */
export interface PluginResourceLike<TOutput> {
  readonly kind: "resource";
  readonly id: string;
  readonly refresh?: { readonly kind: "manual" | "poll" };
  query(input: unknown, context: unknown): TOutput | Promise<TOutput>;
}

/** A page definition preserving the literal path for param inference. */
export type AnyPluginPageDefinition = PluginPageDefinition<never, string>;

/**
 * Any page binding, whatever plugin context it was written against.
 *
 * `render` is contravariant in its context, so a page written for one plugin
 * cannot be assigned to a slot expecting another. The host does not re-derive
 * the context type, so it accepts the shape rather than the type.
 */
export type AnyPluginPage = {
  readonly kind: "page";
  readonly path: string;
  /**
   * `any` in the context position on purpose: a render function is
   * contravariant in its context, so a page written for one plugin is not
   * assignable to a slot demanding another. The host has no use for the page's
   * context type, so this accepts any binding.
   */
  readonly render: (input: {
    readonly context: any;
    readonly params: any;
    readonly resource: PluginResourceReader;
  }) =>
    | PageNode
    | readonly PageNode[]
    | Promise<PageNode | readonly PageNode[]>;
};

export type PluginPageDefinition<
  TConfig = unknown,
  TPath extends string = string,
> = {
  readonly kind: "page";
  readonly path: TPath;
  readonly render: (
    input: PluginPageContext<TConfig> & {
      readonly params: ExtractRouteParams<TPath>;
    },
  ) => PageNode | readonly PageNode[] | Promise<PageNode | readonly PageNode[]>;
};

/**
 * Binds a declared page to a host route.
 *
 * The host owns presentation and the concrete params a request matched, so it
 * receives a render function that already knows both, rather than re-deriving
 * them from the definition.
 */
export type BoundPluginPage = (
  params: Record<string, string>,
) => Promise<readonly PageNode[]>;

/**
 * Defines a page: a route that composes DSUI components.
 *
 * @param options.path - Absolute route path; `:segments` become typed params.
 * @param options.render - Composes the component tree from params and context.
 * @returns A page definition preserving the literal path.
 * @throws {@link InvalidDefinitionError} for a relative path.
 *
 * @example
 * ```ts
 * export const teamPage = definePage({
 *   path: "/teams/:teamId",
 *   render: ({ params }) => [PageHeader({ title: params.teamId })],
 * });
 * ```
 */
export function definePage<
  TPath extends string,
  TConfig = PluginContextLike,
>(options: {
  path: TPath;
  /**
   * A nominal marker for the plugin context type. Optional: when a page reads
   * `context.config` it is inferred from `render`, and a page that never reads
   * the context needs no annotation at all.
   */
  context?: TConfig;
  render: PluginPageDefinition<TConfig, TPath>["render"];
}): PluginPageDefinition<TConfig, TPath> {
  if (!options.path.startsWith("/"))
    throw new InvalidDefinitionError(
      `Page path must start with "/": ${options.path}`,
    );
  return { kind: "page", path: options.path, render: options.render };
}

/**
 * The plugin context a page can rely on, for pages that do not read config.
 *
 * Deliberately loose: a page that never touches `context` should not have to
 * name a type, and one that does gets the real type from inference.
 */
export type PluginContextLike = {
  readonly config: unknown;
} & Record<string, unknown>;

/**
 * Runs a resource's query for a page render.
 *
 * The host owns refreshing, so a render always asks for current data rather
 * than reading a cache. A resource declared with `refresh: poll("2s")` is
 * re-queried on its own interval and the browser re-renders on that cadence.
 */
export function queryResource<TContext, TOutput>(
  definition: PluginResourceLike<TOutput>,
  input: unknown,
  context: TContext,
): TOutput | Promise<TOutput> {
  return (definition.query as (value: unknown, ctx: TContext) => TOutput)(
    input,
    context,
  );
}

/**
 * Matches a concrete URL against a page path pattern.
 *
 * @param path - Route pattern, e.g. `"/teams/:teamId"`.
 * @param url - Concrete URL, e.g. `"/teams/platform"`.
 * @returns Decoded params, or `null` when segments differ.
 *
 * @example
 * ```ts
 * matchRoute("/teams/:teamId", "/teams/platform");
 * // { teamId: "platform" }
 * ```
 */
export function matchRoute(
  path: string,
  url: string,
): Record<string, string> | null {
  const pathSegments = path.split("/").filter((s) => s.length > 0);
  const urlWithoutQuery = url.split(/[?#]/, 1)[0] ?? url;
  const urlSegments = urlWithoutQuery.split("/").filter((s) => s.length > 0);
  if (pathSegments.length !== urlSegments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pathSegments.length; i++) {
    const pattern = pathSegments[i];
    const actual = urlSegments[i];
    if (pattern.startsWith(":")) {
      const name = pattern.slice(1);
      if (!name || actual.length === 0) return null;
      params[name] = decodeURIComponent(actual);
    } else if (pattern !== actual) return null;
  }
  return params;
}
