import type { PluginEventPage, PluginEventReadOptions } from "./events";

export {
  type PluginEventPage,
  type PluginEventReadOptions,
  type PluginSignalEvent,
  signalEventSchema,
} from "./events";

import type { PageNode, SignalType } from "@northgraindata/dsui-adapter-sdk";

export type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";

import { serializeNodes } from "@northgraindata/dsui-adapter-sdk";
import { z } from "zod";

export { PluginRequestError } from "./shared/errors";
// Re-exported so a plugin writes `import { z } from "@northgraindata/dsui-plugin-sdk"`
// exactly as an adapter does, rather than taking a second dependency on zod.
export { z };

import type { PluginActionDefinition, PluginActionPermission } from "./action";
import {
  type AnyPluginPage,
  definePage,
  type ExtractRouteParams,
  matchRoute,
  type PluginPageContext,
  type PluginPageDefinition,
  type PluginResourceReader,
  queryResource,
  resolvePluginPage,
} from "./page";
import type { RefreshStrategy } from "./refresh";
import type {
  AnyPluginResource,
  PluginResourceDefinition,
  PluginResourceLike,
} from "./resource";
import { InvalidDefinitionError } from "./shared/errors";
import type {
  PluginStorage,
  PluginStoreDefinition,
  PluginStoreInstance,
} from "./store.js";

/**
 * Every shared page primitive is re-exported so a plugin can compose the same
 * UI as an adapter without the host adding a case for it. The list is the
 * adapter SDK's public component set rather than a hand-picked subset, so
 * adding a primitive there makes it available to plugins at the same time.
 */
export type {
  CardBadgeTone,
  CardProps,
  ChartKind,
  ChartPoint,
  ChartProps,
  ChartScale,
  ChartWindow,
  FlexProps,
  GaugeProps,
  GaugeTone,
  GridProps,
  PageDocument,
  PageHeaderProps,
  PageNode,
  SectionProps,
} from "@northgraindata/dsui-adapter-sdk";
export {
  Badge,
  Button,
  Card,
  Chart,
  CodeBlock,
  CodeEditor,
  CodeExplorer,
  Collection,
  Columns,
  defineComponent,
  Flex,
  Form,
  Gauge,
  Grid,
  Icon,
  KeyValue,
  Link,
  Meter,
  Notebook,
  NotebookCatalog,
  PageHeader,
  QueryEditor,
  ResourceTree,
  Section,
  Select,
  SplitPane,
  Stack,
  serializeNodes,
  Table,
  Tabs,
  TextInput,
  toneForValue,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
export type {
  JobConcurrency,
  JobContext,
  JobDefinition,
  JobRetry,
  JobRunInput,
} from "./job";
export {
  defineJob,
  InvalidJobDefinitionError,
} from "./job";
export type {
  CreatePluginStoreOptions,
  PluginStorage,
  PluginStoreDefinition,
  PluginStoreHelpers,
  PluginStoreInstance,
  PluginStorePersistence,
  PluginStorePersistenceProvider,
  PluginStorePersistenceRequest,
  PluginStoreStatus,
} from "./store.js";
export {
  assertDatabaseName,
  createPluginStore,
  defineStore,
} from "./store.js";

export const PLUGIN_API_VERSION = 1 as const;

export type PluginMetadata = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly apiVersion: typeof PLUGIN_API_VERSION;
  readonly security?: boolean;
};

export type PluginPage = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly path?: string;
  /**
   * Serves this page without a principal.
   *
   * Only a plugin declaring `security: true` may publish a public page;
   * `definePlugin` rejects it otherwise. An authentication plugin needs one
   * for its sign-in screen, which by definition exists before anyone is
   * signed in. Any other plugin asking for this has no legitimate use, and
   * failing setup is clearer than quietly exposing content.
   */
  readonly public?: boolean;
  /**
   * How the web app frames this page.
   *
   * `"app"` is the default: sidebar, command palette, the normal chrome.
   * `"bare"` renders the page's own content with no shell around it, which is
   * what a sign-in screen wants.
   */
  readonly shell?: "app" | "bare";
};

export type RuntimePluginPage = PluginPage & {
  readonly render: (
    params: Record<string, string>,
  ) => Promise<readonly PageNode[]>;
};

export type PluginNavigationItem = {
  readonly id: string;
  readonly area: "primary" | "secondary";
  readonly label: string;
  readonly pageId: string;
  readonly order?: number;
};

export type PluginUiSlot = {
  readonly id: string;
  readonly slot: PluginSlotName;
  readonly order?: number;
};

import type {
  JobConcurrency,
  JobContext,
  JobDefinition,
  JobRetry,
} from "./job";
import type {
  AnyPluginSlot,
  PluginSlotDefinition,
  PluginSlotName,
} from "./slot";
import { defineSlot } from "./slot";

export type { PluginSlotDefinition, PluginSlotName };

export type RuntimePluginSlot = PluginUiSlot & {
  readonly render: (input: {
    service?: PluginServiceSummary;
  }) => Promise<readonly PageNode[]>;
};

export type PluginServiceSummary = {
  readonly id: string;
  readonly name: string;
  readonly adapter: string;
  readonly adapterName?: string;
  readonly managedBy: "configuration" | "ui";
  readonly iconUrl?: string;
};

export type PluginServiceHealth =
  | "healthy"
  | "warning"
  | "unavailable"
  | "unknown";

/**
 * One measured health signal, as reported by the service's adapter.
 *
 * `id` is an open string. The host and the SDK never interpret it, so a new
 * signal needs no change in either.
 */
export type PluginServiceHealthCheck = {
  readonly id: string;
  readonly label: string;
  readonly ok: boolean;
  readonly detail?: string;
};

export type PluginServiceProbe = {
  readonly id: string;
  readonly health: PluginServiceHealth;
  readonly detail?: string;
  readonly latencyMs?: number;
  /**
   * Health from 0 to 100, computed by the adapter from its own signals.
   *
   * Absent when the adapter reports no score; a consumer must treat absence as
   * "not scored" rather than as zero.
   */
  readonly score?: number;
  readonly checks?: readonly PluginServiceHealthCheck[];
};

export type PluginServiceResource = {
  readonly id: string;
  readonly description?: string;
  readonly policy?: "metadata" | "preview" | "sql";
  readonly inputSchema?: Record<string, unknown>;
};
export type PluginServiceAction = {
  readonly id: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
};
export type PluginInvocationOptions = {
  signal?: AbortSignal;
  origin?: { pluginId: string; runId?: string };
};
export type PluginServiceDescription = {
  resources: readonly PluginServiceResource[];
  actions: readonly PluginServiceAction[];
};
export interface PluginIntegrationCatalog {
  available(pluginId: string): boolean;
  query(pluginId: string, resourceId: string, input: unknown): Promise<unknown>;
  call(pluginId: string, procedureId: string, input: unknown): Promise<unknown>;
}

export interface PluginServiceCatalog {
  /** Discover action schemas only; this grants no execution capability. */
  actions?(id: string): Promise<readonly PluginServiceAction[] | null>;
  /** Read-only adapter resource descriptors, scoped to service visibility. */
  resources?(id: string): Promise<readonly PluginServiceResource[] | null>;
  /** Execute a declared adapter resource without exposing connection credentials. */
  readResource?(
    id: string,
    resourceId: string,
    input: unknown,
  ): Promise<unknown>;
  describe?(id: string): Promise<PluginServiceDescription | null>;
  query?(id: string, resourceId: string, input: unknown): Promise<unknown>;
  execute?(
    id: string,
    actionId: string,
    input: unknown,
    options?: PluginInvocationOptions,
  ): Promise<unknown>;
  list(input?: { readonly cursor?: string; readonly limit?: number }): Promise<{
    readonly items: PluginServiceSummary[];
    readonly nextCursor?: string;
  }>;
  get(id: string): Promise<PluginServiceSummary | null>;
  /** Declared signals available for a visible service, without opening its connection. */
  signals?(
    id: string,
  ): Promise<readonly { id: string; type: SignalType }[] | null>;
  /**
   * Asks the host to probe a service connection and report its health.
   *
   * The host owns connection decryption and the adapter call, so a plugin
   * never sees connection secrets. Probing is explicit rather than part of
   * `list`: health is not knowable without contacting the external system,
   * so callers choose when to pay that cost. `null` means the service is
   * unknown to the host.
   */
  probe(
    id: string,
    options?: { readonly timeoutMs?: number },
  ): Promise<PluginServiceProbe | null>;
}

export type PluginReadinessStatus = "ready" | "disabled" | "unavailable";

export type PluginCatalog = {
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    status: PluginReadinessStatus;
    detail?: string;
  }>;
  pages: Array<PluginPage & { pluginId: string }>;
  navigation: Array<PluginNavigationItem & { pluginId: string }>;
  slots: Array<PluginUiSlot & { pluginId: string }>;
};

export type PluginSlotResult = {
  serviceId: string;
  pluginId: string;
  slotId: string;
  nodes: readonly PageNode[];
  error?: string;
};

/**
 * DSUI's built-in roles.
 *
 * These are a convenience, not the identity model. A plugin that manages
 * richer access control (teams, groups, per-resource grants) still returns a
 * principal; the extra structure travels in `attributes` and is evaluated by
 * that plugin's own `authorize`. The role only selects the default
 * permission set, so OSS can ship without an identity provider and a
 * first-party RBAC plugin can layer on top without changing this contract.
 */
export type PluginRole = "owner" | "admin" | "operator" | "viewer";

/**
 * The identity a request runs as.
 *
 * `role` is required so the host can apply a sane default permission set
 * without knowing anything about the plugin that authenticated the request.
 * `attributes` carries plugin-specific structure (team ids, scopes, tenancy)
 * and is never interpreted by the host.
 */
export type PluginPrincipal = {
  id: string;
  role: PluginRole;
  /** Plugin-defined context. Opaque to the host; visible to plugins. */
  attributes?: Readonly<Record<string, unknown>>;
};

export type PluginPermission = "inspect" | "execute" | "manage";
export type PluginResource = {
  type: "service" | "plugin";
  id: string;
};

export interface PluginAuthenticationProvider {
  authenticate(
    request: Request,
  ): Promise<PluginPrincipal | null> | PluginPrincipal | null;
  /**
   * Serves the plugin's own identity endpoints.
   *
   * Sign-in, registration, sign-out, session lookup and SSO callbacks are the
   * plugin's business: it owns the credential store and the session cookie
   * format. What it cannot do is decide who reaches the rest of DSUI — that
   * stays with `authenticate`, which the host calls on every API request.
   *
   * The host mounts this under a fixed prefix ahead of the authentication
   * middleware, because these endpoints are the ones a logged-out browser has
   * to reach. It is deliberately not a router: a plugin cannot add middleware,
   * intercept another plugin's routes, or reach a path outside its own prefix.
   */
  routes?(request: Request): Promise<Response> | Response;
}

export interface PluginAuthorizationProvider {
  /**
   * Narrows what the principal's role already allows.
   *
   * A provider cannot widen the role's default permissions: the host applies
   * the role grant first and this runs only to reduce it. That keeps an OSS
   * role a hard ceiling, so a plugin shipping a bug cannot accidentally grant
   * more than the role implies.
   */
  authorize(input: {
    principal: PluginPrincipal;
    permission: PluginPermission;
    resource?: PluginResource;
  }): Promise<boolean> | boolean;
}

export type PluginProcedure<
  TContext = unknown,
  TInput = unknown,
  TOutput = unknown,
> = {
  readonly id: string;
  readonly input: z.ZodType<TInput>;
  readonly output?: z.ZodType<TOutput>;
  readonly permission: "inspect" | "execute" | "manage";
  readonly handler: (
    context: TContext,
    input: TInput,
  ) => Promise<TOutput> | TOutput;
};

export type RuntimePluginProcedure = {
  readonly id: string;
  readonly input: z.ZodTypeAny;
  readonly output?: z.ZodTypeAny;
  readonly permission: "inspect" | "execute" | "manage";
  readonly invoke: (input: unknown) => Promise<unknown> | unknown;
};

/** A resource as the host publishes it for browser scheduling. */
export type RuntimePluginResource = {
  readonly id: string;
  readonly input?: z.ZodTypeAny;
  readonly refresh: RefreshStrategy;
  readonly invoke: (input: unknown) => Promise<unknown>;
};

export interface RuntimePluginRegistry {
  page(page: RuntimePluginPage): void;
  navigation(item: PluginNavigationItem): void;
  slot(slot: RuntimePluginSlot): void;
  procedure(procedure: RuntimePluginProcedure): void;
  action(action: RuntimePluginAction): void;
  resource(resource: RuntimePluginResource): void;
  job(job: RuntimePluginJob): void;
  authentication(provider: PluginAuthenticationProvider): void;
  authorization(provider: PluginAuthorizationProvider): void;
}

/** A declared job as the host publishes it. */
export type RuntimePluginJob = {
  readonly id: string;
  readonly input?: z.ZodTypeAny;
  readonly schedule?: string;
  readonly intervalMs?: number;
  readonly onSignals?: readonly string[];
  readonly concurrency: JobConcurrency;
  readonly timeoutMs: number;
  readonly retry: JobRetry;
  readonly invoke: (
    input: unknown,
    context: {
      runId: string;
      signal: AbortSignal;
      logger: JobContext["logger"];
      reportSideEffect(): void;
    },
  ) => Promise<void>;
};

/** A declared action as the host publishes it. */
export type RuntimePluginAction = {
  readonly id: string;
  readonly input: z.ZodTypeAny;
  readonly output?: z.ZodTypeAny;
  readonly permission: PluginActionPermission;
  readonly invoke: (input: unknown) => Promise<unknown>;
};

/**
 * Registers a page declared with `definePage`.
 *
 * A definition is inert; this binds it to the runtime. `id`, `title` and the
 * rest come from the plugin rather than the page, because a page describes a
 * route and the host owns how that route is presented.
 */
export interface PluginRegisteredPage {
  id: string;
  title: string;
  description?: string;
  public?: boolean;
  shell?: "app" | "bare";
  definition: PluginPageDefinition<unknown>;
}

export interface PluginRegistry<TConfig = unknown> {
  signal(definition: PluginSignalDefinition): void;
  /** Binds a `definePage` declaration to a host route. */
  page(
    page: AnyPluginPage,
    presentation: {
      id: string;
      title: string;
      description?: string;
      public?: boolean;
      shell?: "app" | "bare";
    },
  ): void;
  navigation(item: PluginNavigationItem): void;
  /** Binds a `defineSlot` declaration to a named host UI slot. */
  slot(slot: AnyPluginSlot): void;
  procedure<TInput, TOutput = unknown>(
    procedure: PluginProcedure<PluginContext<TConfig>, TInput, TOutput>,
  ): void;
  /** Binds a `defineAction` declaration. */
  action(action: PluginActionDefinition<PluginContext<TConfig>>): void;
  /** Binds a `defineResource` declaration and its freshness policy. */
  resource(resource: AnyPluginResource): void;
  /**
   * Binds a `defineJob` declaration.
   *
   * The host validates the cron expression and rejects a duplicate job id at
   * load, so a job that could never fire is a startup error rather than a
   * silent no-op that only shows up when someone waits for it.
   */
  job(job: JobDefinition): void;
  authentication(provider: PluginAuthenticationProvider): void;
  authorization(provider: PluginAuthorizationProvider): void;
}

export interface PluginCapabilities {
  readonly plugins?: PluginIntegrationCatalog;
  readonly access: {
    /** Identity of the authenticated request; absent in background work. */
    principal?(): PluginPrincipal | null;
    requireAdmin?(): Promise<void>;
    require(serviceId: string, permission: PluginPermission): Promise<void>;
  };
  readonly jobs: {
    enqueue(jobId: string, input: unknown): Promise<{ runId: string }>;
  };
  readonly events: {
    /** Read persisted signals in append order; cursor "latest" starts at the current tail. */
    read?(options?: PluginEventReadOptions): Promise<PluginEventPage>;
    emit(
      signalId: string,
      payload: unknown,
      serviceId?: string,
      type?: SignalType,
    ): Promise<void>;
  };
}

export type PluginSignalDefinition = {
  id: string;
  payload: z.ZodTypeAny;
  type?: SignalType;
};

function unavailableCapability(): never {
  throw new Error("Plugin host capability is unavailable");
}

export interface PluginContext<TConfig = unknown> extends PluginCapabilities {
  readonly pluginId: string;
  readonly config: Readonly<TConfig>;
  readonly services: PluginServiceCatalog;
  /**
   * Relational storage in this plugin's own directory.
   *
   * A plugin owns everything it writes here: its schema, its migrations, its
   * file. The host creates the directory and never reads the contents, which is
   * what lets an auth plugin hold users and sessions while the host schema
   * stays unaware of them.
   */
  readonly storage: PluginStorage;
  /**
   * Typed JSON state, namespaced to this plugin.
   *
   * The mirror of the adapter SDK's store layer, for values a plugin reads and
   * writes as one whole — the selected team, a dismissed notice. Use
   * `storage` instead for anything queried relationally.
   */
  readonly stores: PluginStores;
  readonly logger: {
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, metadata?: Record<string, unknown>): void;
  };
}

/**
 * Creates store instances bound to the calling plugin.
 *
 * The returned instances persist under the plugin's namespace, so two plugins
 * may define a store with the same id without colliding.
 */
export interface PluginStores {
  /**
   * The instance for a declared store, created on first use.
   *
   * Reads as `get(series)` because a plugin author thinks in terms of the
   * declaration they wrote, not the instance behind it. The two routes to the
   * same object: declaring the store registers it, and `get` returns it.
   */
  get<
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: PluginStoreDefinition<TState, TActions>,
  ): PluginStoreInstance<TState, TActions>;
  create<
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: PluginStoreDefinition<TState, TActions>,
  ): PluginStoreInstance<TState, TActions>;
}

export interface PluginDefinition<TConfig = unknown> {
  readonly kind: "dsui-plugin";
  readonly metadata: PluginMetadata;
  /**
   * Typed as the schema's *output*, so `TConfig` reflects values after
   * defaults are applied. Declaring the input as `unknown` lets a plugin
   * write `z.object({ timeoutMs: z.number().default(5_000) })` and still
   * receive a fully populated `config` in its procedures.
   */
  readonly configSchema: z.ZodType<TConfig, z.ZodTypeDef, unknown>;
  readonly requires?: readonly string[];
  readonly setup: (
    registry: PluginRegistry<TConfig>,
    config: Readonly<TConfig>,
  ) => void;
  readonly start?: (context: PluginContext<TConfig>) => Promise<void> | void;
  readonly stop?: () => Promise<void> | void;
}

export interface PreparedPlugin {
  readonly setup: (registry: RuntimePluginRegistry) => void;
  readonly start: () => Promise<void> | void;
}

export interface RuntimePluginDefinition {
  readonly kind: "dsui-plugin";
  readonly metadata: PluginMetadata;
  readonly configSchema: z.ZodTypeAny;
  readonly requires?: readonly string[];
  readonly prepare: (
    config: unknown,
    host: Pick<
      PluginContext<unknown>,
      "services" | "storage" | "stores" | "logger"
    > &
      Partial<PluginCapabilities>,
  ) => PreparedPlugin;
  readonly stop?: () => Promise<void> | void;
}

export function definePlugin<TConfig>(
  definition: Omit<PluginDefinition<TConfig>, "kind">,
): PluginDefinition<TConfig> & RuntimePluginDefinition {
  const plugin: PluginDefinition<TConfig> & RuntimePluginDefinition = {
    kind: "dsui-plugin",
    ...definition,
    prepare(rawConfig, host) {
      const config = definition.configSchema.parse(rawConfig);
      const signals = new Map<string, PluginSignalDefinition>();
      const executeService = host.services.execute;
      const context: PluginContext<TConfig> = {
        pluginId: definition.metadata.id,
        config,
        services: {
          ...host.services,
          ...(executeService
            ? {
                execute: (id, actionId, input, options) =>
                  executeService(id, actionId, input, {
                    ...options,
                    origin: {
                      pluginId: definition.metadata.id,
                      ...(options?.origin?.runId
                        ? { runId: options.origin.runId }
                        : {}),
                    },
                  }),
              }
            : {}),
        },
        plugins: host.plugins,
        storage: host.storage,
        stores: {
          // `get` must go through the host's own `get`: the host caches one
          // instance per definition there, and routing `get` to `create` gave
          // every caller a fresh instance that re-read its row.
          get: (definition) => host.stores.get(definition),
          create: (definition) => host.stores.create(definition),
        },
        logger: host.logger,
        access: host.access ?? { require: async () => unavailableCapability() },
        jobs: host.jobs ?? { enqueue: async () => unavailableCapability() },
        events: {
          read: async (options) => {
            if (!host.events?.read) unavailableCapability();
            return host.events.read(options);
          },
          emit: async (id, payload, serviceId) => {
            const signal = signals.get(id);
            if (!signal) throw new Error(`Undeclared plugin signal "${id}"`);
            if (!host.events) unavailableCapability();
            await host.events.emit(
              id,
              signal.payload.parse(payload),
              serviceId,
              signal.type ?? "info",
            );
          },
        },
      };
      return {
        setup(runtimeRegistry) {
          const registry: PluginRegistry<TConfig> = {
            signal: (signal) => {
              if (
                !/^[a-z][a-z0-9-]*$/.test(signal.id) ||
                signals.has(signal.id)
              )
                throw new InvalidDefinitionError(
                  "Invalid or duplicate plugin signal",
                );
              signals.set(signal.id, signal);
            },
            page: (page, presentation) => {
              if (presentation.public && !definition.metadata.security)
                throw new InvalidDefinitionError(
                  "Only plugins declaring security: true may register a public page",
                );
              runtimeRegistry.page({
                id: presentation.id,
                path: page.path,
                title: presentation.title,
                ...(presentation.description
                  ? { description: presentation.description }
                  : {}),
                ...(presentation.public ? { public: presentation.public } : {}),
                ...(presentation.shell ? { shell: presentation.shell } : {}),
                render: async (params) =>
                  serializeNodes(
                    await page.render({
                      context,
                      params,
                      resource: (resource, input) =>
                        queryResource(resource, input, context),
                    }),
                  ),
              });
            },
            navigation: (item) => runtimeRegistry.navigation(item),
            slot: (slot) =>
              runtimeRegistry.slot({
                id: slot.id,
                slot: slot.slot,
                order: slot.order,
                render: async ({ service }) =>
                  serializeNodes(await slot.render({ context, service })),
              }),
            // A declared action is a procedure: same invoke path, same
            // validation, one name for the concept across both tiers.
            action: (action) =>
              runtimeRegistry.action({
                id: action.id,
                input: action.input ?? z.undefined(),
                ...(action.output ? { output: action.output } : {}),
                permission: action.permission,
                invoke: async (input) => {
                  const parsed =
                    action.input == null ? input : action.input.parse(input);
                  const result = await action.run(parsed, context);
                  return action.output ? action.output.parse(result) : result;
                },
              }),
            job: (job) =>
              runtimeRegistry.job({
                id: job.id,
                ...(job.inputSchema ? { input: job.inputSchema } : {}),
                ...(job.schedule ? { schedule: job.schedule } : {}),
                ...(job.intervalMs !== undefined
                  ? { intervalMs: job.intervalMs }
                  : {}),
                ...(job.onSignals ? { onSignals: [...job.onSignals] } : {}),
                concurrency: job.concurrency,
                timeoutMs: job.timeoutMs,
                retry: job.retry,
                invoke: async (input, runContext) => {
                  const parsed =
                    job.inputSchema == null
                      ? input
                      : job.inputSchema.parse(input);
                  await job.run({
                    input: parsed,
                    runId: runContext.runId,
                    context: {
                      pluginId: definition.metadata.id,
                      config: context.config,
                      services: context.services,
                      storage: context.storage,
                      stores: context.stores,
                      access: context.access,
                      jobs: context.jobs,
                      events: context.events,
                      plugins: context.plugins,
                      signal: runContext.signal,
                      logger: {
                        info: runContext.logger.info,
                        warn: runContext.logger.warn,
                        error: runContext.logger.error,
                      },
                      reportSideEffect: () => runContext.reportSideEffect(),
                    },
                  });
                },
              }),
            resource: (resource) =>
              runtimeRegistry.resource({
                id: resource.id,
                ...(resource.input ? { input: resource.input } : {}),
                refresh: resource.refresh,
                invoke: async (input) => {
                  const parsed =
                    resource.input == null
                      ? input
                      : resource.input.parse(input);
                  return resource.query(parsed, context);
                },
              }),
            procedure: (procedure) =>
              runtimeRegistry.procedure({
                id: procedure.id,
                input: procedure.input,
                output: procedure.output,
                permission: procedure.permission,
                invoke: async (input) => {
                  const parsedInput = procedure.input.parse(input);
                  const result = await procedure.handler(context, parsedInput);
                  return procedure.output
                    ? procedure.output.parse(result)
                    : result;
                },
              }),
            authentication: (provider) => {
              if (!definition.metadata.security)
                throw new Error(
                  "Authentication plugins must declare security: true",
                );
              runtimeRegistry.authentication(provider);
            },
            authorization: (provider) => {
              if (!definition.metadata.security)
                throw new Error(
                  "Authorization plugins must declare security: true",
                );
              runtimeRegistry.authorization(provider);
            },
          };
          definition.setup(registry, config);
        },
        start: () => definition.start?.(context),
      };
    },
  };
  return plugin;
}

// The defineX family, mirroring the adapter SDK so a plugin author uses one
// vocabulary across both tiers.
export {
  defineAction,
  type PluginActionDefinition,
  type PluginActionPermission,
  type PluginActionReference,
} from "./action";
export {
  manual,
  type PollInterval,
  poll,
  type RefreshStrategy,
} from "./refresh";
export {
  catalogResource,
  defineResource,
  type PluginResourceDefinition,
  type PluginResourceLike,
} from "./resource";
export { InvalidDefinitionError, SdkError } from "./shared/errors";
export {
  definePage,
  defineSlot,
  type ExtractRouteParams,
  matchRoute,
  type PluginPageContext,
  type PluginResourceReader,
  queryResource,
  resolvePluginPage,
};
