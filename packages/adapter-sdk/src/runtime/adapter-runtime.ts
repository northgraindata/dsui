import type { ActionBinding, ActionResult } from "../action/index";
import type { AdapterDefinition } from "../adapter/index";
import { type AnyPageDefinition, matchRoute } from "../page/index";
import type { AnyResourceDefinition, ResourceBinding } from "../resource/index";
import { UnknownPageError } from "../shared/errors";
import {
  createStoreInstance,
  type StoreDefinition,
  type StoreInstance,
} from "../store/index";
import { ActionExecutor } from "./action-executor";
import { createPageScope } from "./page-scope";
import { ResourceExecutor } from "./resource-executor";
import { StoreRegistry } from "./store-registry";
import type {
  ActionExecutionOptions,
  AdapterInstance,
  PageScope,
  ResourceResult,
} from "./types";

/**
 * Validates configuration, builds the context, and returns a live
 * {@link AdapterRuntime} with isolated stores and execution state.
 *
 * Lifecycle: validate config → create context → wire collaborators.
 * Teardown (in reverse) happens on `dispose()`.
 *
 * @param definition - The adapter definition.
 * @param rawConfig - Unvalidated instance configuration.
 * @returns A live, isolated adapter instance.
 *
 * @example
 * ```ts
 * const prod = await createAdapterInstance(snowflakeAdapter, {
 *   accountIdentifier: "org-prod",
 *   token: process.env.SNOWFLAKE_TOKEN,
 * });
 * // ...later:
 * await prod.dispose();
 * ```
 */
export async function createAdapterInstance<TContext, TConfig>(
  definition: AdapterDefinition<TContext, TConfig>,
  rawConfig: unknown = {},
): Promise<AdapterInstance<TContext>> {
  const config =
    definition.connectionSchema != null
      ? definition.connectionSchema.parse(rawConfig)
      : rawConfig;
  const context = await definition.createContext(config);
  return new AdapterRuntime(
    definition as AdapterDefinition<TContext, unknown>,
    context,
  );
}

/**
 * Live adapter instance: one configured connection with isolated
 * context, stores, and execution state.
 *
 * Owns three collaborators: a {@link StoreRegistry} for adapter-scoped
 * state, a {@link ResourceExecutor} for external data, and an
 * {@link ActionExecutor} for commands. It tears them all down on
 * `dispose()`. Returned by {@link createAdapterInstance}, which also
 * validates configuration and builds the context.
 */
export class AdapterRuntime<TContext> implements AdapterInstance<TContext> {
  /** The definition this instance was created from. */
  readonly definition: AdapterDefinition<TContext, unknown>;
  /** Runtime dependencies built by the definition's context factory. */
  readonly context: TContext;

  private readonly stores: StoreRegistry;
  private readonly resources: ResourceExecutor<TContext>;
  private readonly actions: ActionExecutor<TContext>;
  private disposed = false;

  /**
   * @param definition - The adapter definition.
   * @param context - The built context for this instance.
   */
  constructor(
    definition: AdapterDefinition<TContext, unknown>,
    context: TContext,
  ) {
    this.definition = definition;
    this.context = context;
    this.stores = new StoreRegistry(definition);
    this.resources = new ResourceExecutor<TContext>(context);
    this.actions = new ActionExecutor<TContext>(context, (resource, input) =>
      this.resources.invalidate(resource, input),
    );
  }

  /**
   * Returns the adapter-scoped store instance, creating it on first
   * use. Page-scoped stores are created per page scope instead.
   *
   * @param definition - The store definition.
   */
  store<
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: StoreDefinition<TState, TActions>,
  ): StoreInstance<TState, TActions> {
    if (definition.scope === "adapter")
      return this.stores.adapterStore(definition);
    return createStoreInstance(definition);
  }

  /**
   * Executes a resource binding once.
   *
   * @param binding - The binding to execute.
   */
  executeResource<TInput, TOutput>(
    binding: ResourceBinding<TInput, TOutput, never>,
  ): Promise<ResourceResult<TOutput>> {
    return this.resources.execute(binding);
  }

  /**
   * Subscribes to a binding with immediate execution and background
   * refreshing. See {@link AdapterInstance.watchResource}.
   *
   * @param binding - The binding to watch.
   * @param listener - Called with each result.
   * @returns Unsubscribe function.
   */
  watchResource<TInput, TOutput>(
    binding: ResourceBinding<TInput, TOutput, never>,
    listener: (result: ResourceResult<TOutput>) => void,
  ): () => void {
    return this.resources.watch(binding, listener);
  }

  /**
   * Executes an action binding.
   *
   * @param binding - The binding to execute.
   * @param options - Optional abort signal.
   */
  executeAction<TInput, TOutput>(
    binding: ActionBinding<TInput, TOutput, never>,
    options?: ActionExecutionOptions,
  ): Promise<ActionResult<TOutput>> {
    return this.actions.execute(binding, options);
  }

  /**
   * Re-executes watched bindings (all, per resource, or per binding).
   *
   * @param resource - Resource to narrow invalidation to.
   * @param input - Binding input to narrow invalidation to.
   */
  invalidate(resource?: AnyResourceDefinition, input?: unknown): void {
    this.resources.invalidate(resource, input);
  }

  /**
   * Creates a page scope for a URL.
   *
   * @param url - Concrete URL, e.g. `"/databases/ANALYTICS"`.
   * @throws {@link UnknownPageError} when nothing matches.
   */
  createPageScope(url: string): PageScope {
    for (const page of this.definition.pages) {
      const params = matchRoute(page.path, url);
      if (params) return this.createPageScopeFor(page, params);
    }
    throw new UnknownPageError(url);
  }

  /**
   * Creates a page scope for a definition with explicit params.
   *
   * @param page - The page definition.
   * @param params - Route params (default: none).
   */
  createPageScopeFor(
    page: AnyPageDefinition,
    params: Record<string, string> = {},
  ): PageScope {
    return createPageScope(this.stores, page, params);
  }

  /**
   * Stops polling, destroys stores, then disposes the context.
   * Safe to call more than once.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.resources.dispose();
    this.stores.dispose();
    await this.definition.disposeContext?.(this.context);
  }
}
