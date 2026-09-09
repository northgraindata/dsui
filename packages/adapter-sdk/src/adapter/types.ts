import type { z } from "zod";
import type { AnyActionDefinition } from "../action/index";
import type { AnyPageDefinition } from "../page/index";
import type { AnyResourceDefinition } from "../resource/index";
import type { AnyStoreDefinition } from "../store/index";

/**
 * Current SDK version. Adapter definitions record it so future
 * major versions can detect incompatibility.
 *
 * @example
 * ```ts
 * adapter.sdkVersion === ADAPTER_SDK_VERSION; // true
 * ```
 */
export const ADAPTER_SDK_VERSION = "0.2.0";

/**
 * Adapter identity and presentation.
 *
 * Distinct from core's `AdapterMetadata` (server-side presentation
 * overrides): this is the author-declared identity compiled into the
 * adapter definition.
 */
export interface AdapterInfo {
  /** Kebab-case id, e.g. `"snowflake"`. Doubles as the icon convention. */
  id: string;
  /** Display name, e.g. `"Snowflake"`. */
  name: string;
  /** SemVer version of the adapter itself, e.g. `"1.0.0"`. */
  version: string;
  /** Author or publisher name. */
  author?: string;
  /**
   * Icon URL shown in listings (marketplace, library, service picker).
   * Any absolute https URL or data URI; renderers fall back gracefully
   * when missing or unreachable.
   */
  iconUrl?: string;
  /** One-line description for listings. */
  description?: string;
}

/**
 * One named connection method. When an adapter declares several ways to
 * connect (e.g. DuckDB in-memory vs file vs remote), each method gets a
 * label and its own Zod schema for the fields the connection form shows
 * on that tab. The runtime validates against the selected method and tags
 * the parsed config with the `method` discriminator.
 */
export interface ConnectionMethodDefinition {
  /** Kebab-case id, e.g. `"file"`. Doubles as the `method` value in config. */
  readonly id: string;
  /** Tab label shown in the connection form, e.g. `"Local file"`. */
  readonly label: string;
  /** One-line description shown under the tab. */
  readonly description?: string;
  /** Zod object schema for this method's fields (excludes `method`). */
  readonly schema: z.ZodTypeAny;
  /**
   * Presentational group, e.g. the `"remote"` tab holding `s3`, `gcs`,
   * and `quack` as sub-tabs. Validation still discriminates on the leaf
   * `id`; the group never appears in the parsed config.
   */
  readonly group?: {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
  };
}

/**
 * An adapter definition: the composition root binding identity, context,
 * stores, resources, actions, and pages for one supported system.
 *
 * One definition supports many isolated instances (e.g. `snowflake-prod`
 * and `snowflake-dev`); adapter code must never rely on global singletons.
 * Created by {@link defineAdapter}; never constructed by hand.
 */
export interface AdapterDefinition<TContext = unknown, TConfig = unknown> {
  /** Discriminant: always `"adapter"`. */
  readonly kind: "adapter";
  /** SDK version this definition was built with. */
  readonly sdkVersion: string;
  /** Author-declared identity and presentation. */
  readonly metadata: AdapterInfo;
  /** Optional Zod schema validating per-instance configuration. */
  readonly connectionSchema?: z.ZodTypeAny;
  /**
   * Named connection methods. Present when the adapter declares
   * `connectionMethods`; `connectionSchema` is the synthesized
   * discriminated union over `method`.
   */
  readonly connectionMethods?: readonly ConnectionMethodDefinition[];
  /**
   * Builds runtime dependencies (API client, logger) for one configured
   * instance. Must not hold UI state. That belongs in stores.
   *
   * @param config - Validated instance configuration.
   */
  readonly createContext: (config: TConfig) => Promise<TContext> | TContext;
  /**
   * Releases context resources (pools, clients). Called once per
   * instance disposal.
   */
  readonly disposeContext?: (ctx: TContext) => Promise<void> | void;
  /** Adapter- and page-scoped store definitions. */
  readonly stores: readonly AnyStoreDefinition[];
  /** External-data definitions. */
  readonly resources: readonly AnyResourceDefinition[];
  /** Command/mutation definitions. */
  readonly actions: readonly AnyActionDefinition[];
  /** Route definitions. */
  readonly pages: readonly AnyPageDefinition[];
}

/**
 * Options accepted by {@link defineAdapter}.
 */
export interface DefineAdapterOptions<TContext, TConfig> {
  /** Adapter identity and presentation. */
  metadata: AdapterInfo;
  /**
   * Named connection methods keyed by kebab-case id. Each entry is either
   * a leaf with a label and a Zod object schema for its fields, or a group
   * with a label and nested `methods` rendered as sub-tabs. Groups are
   * presentational only: the definition exposes the flattened leaves and
   * `connectionSchema` is synthesized from them as a discriminated union
   * over `method`. With one leaf total the form shows its fields without
   * tabs.
   */
  connectionMethods?: Record<
    string,
    | { label: string; description?: string; schema: z.ZodTypeAny }
    | {
        label: string;
        description?: string;
        methods: Record<
          string,
          { label: string; description?: string; schema: z.ZodTypeAny }
        >;
      }
  >;
  /**
   * Builds the context for one instance. May be omitted for adapters
   * with no runtime dependencies (context defaults to `{}`).
   */
  context?: (config: TConfig) => Promise<TContext> | TContext;
  /** Releases context resources on instance disposal. */
  disposeContext?: (ctx: TContext) => Promise<void> | void;
  /** Store definitions used by this adapter. */
  stores?: readonly AnyStoreDefinition[];
  /** Resource definitions used by this adapter. */
  resources?: readonly AnyResourceDefinition[];
  /** Action definitions used by this adapter. */
  actions?: readonly AnyActionDefinition[];
  /** Page definitions used by this adapter. */
  pages?: readonly AnyPageDefinition[];
}
