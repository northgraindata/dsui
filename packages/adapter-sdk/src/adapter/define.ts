import { InvalidDefinitionError } from "../shared/errors";
import {
  ADAPTER_SDK_VERSION,
  type AdapterDefinition,
  type DefineAdapterOptions,
} from "./types";

const KEBAB = /^[a-z][a-z0-9-]*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Defines an adapter: the composition root for one supported system.
 *
 * The same definition backs many isolated instances; every instance gets
 * its own context, stores, and execution state.
 *
 * @param options - Identity, context factory, and member definitions.
 * @returns An adapter definition ready for `createAdapterInstance`.
 * @throws {@link InvalidDefinitionError} for bad identity or duplicate
 * member ids/paths.
 *
 * @example
 * ```ts
 * export default defineAdapter({
 *   metadata: { id: "hello", name: "Hello", version: "1.0.0" },
 *   context: (config) => ({ client: new Client(config) }),
 *   pages: [definePage({ path: "/", render: () => [] })],
 * });
 * ```
 */
export function defineAdapter<TContext, TConfig = Record<string, never>>(
  options: DefineAdapterOptions<TContext, TConfig>,
): AdapterDefinition<TContext, TConfig> {
  const { metadata } = options;
  if (!KEBAB.test(metadata.id))
    throw new InvalidDefinitionError(
      `Adapter id must be kebab-case: ${metadata.id}`,
    );
  if (!metadata.name)
    throw new InvalidDefinitionError("Adapter name must be non-empty");
  if (!SEMVER.test(metadata.version))
    throw new InvalidDefinitionError(
      `Adapter version must be SemVer: ${metadata.version}`,
    );

  const stores = options.stores ? [...options.stores] : [];
  const resources = options.resources ? [...options.resources] : [];
  const actions = options.actions ? [...options.actions] : [];
  const pages = options.pages ? [...options.pages] : [];

  assertUnique(
    stores.map((s) => s.id),
    "store",
  );
  assertUnique(
    resources.map((r) => r.id),
    "resource",
  );
  assertUnique(
    actions.map((a) => a.id),
    "action",
  );
  assertUnique(
    pages.map((p) => p.path),
    "page path",
  );

  const createContext =
    options.context ??
    ((() => ({}) as unknown) as (config: TConfig) => TContext);

  return {
    kind: "adapter",
    sdkVersion: ADAPTER_SDK_VERSION,
    metadata: { ...metadata },
    connectionSchema: options.connectionSchema,
    createContext,
    disposeContext: options.disposeContext,
    stores,
    resources,
    actions,
    pages,
  };
}

function assertUnique(ids: readonly string[], what: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id))
      throw new InvalidDefinitionError(`Duplicate adapter ${what}: ${id}`);
    seen.add(id);
  }
}
