import { z } from "zod";
import { InvalidDefinitionError } from "../shared/errors";
import {
  ADAPTER_SDK_VERSION,
  type AdapterDefinition,
  type ConnectionMethodDefinition,
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

  const connectionMethods = normalizeConnectionMethods(
    options.connectionMethods,
  );
  const connectionSchema = connectionUnion(connectionMethods);

  return {
    kind: "adapter",
    sdkVersion: ADAPTER_SDK_VERSION,
    metadata: { ...metadata },
    connectionSchema,
    connectionMethods,
    createContext,
    disposeContext: options.disposeContext,
    stores,
    resources,
    actions,
    pages,
  };
}

/**
 * Turns the author-facing `connectionMethods` record into the ordered,
 * validated leaf array the definition exposes. Groups contribute no
 * schema of their own; each child becomes a leaf tagged with its group.
 * Ids (leaf and group) must be kebab-case and share one namespace; every
 * leaf needs a non-empty label and a Zod object schema; every group needs
 * at least one child. Groups nest exactly one level.
 */
function normalizeConnectionMethods(
  record: DefineAdapterOptions<unknown, unknown>["connectionMethods"],
): readonly ConnectionMethodDefinition[] | undefined {
  if (!record) return undefined;
  const methods: ConnectionMethodDefinition[] = [];
  const groupIds: string[] = [];
  for (const [id, entry] of Object.entries(record)) {
    assertMethodId(id);
    if (!entry.label)
      throw new InvalidDefinitionError(
        `Connection method "${id}" requires a label`,
      );
    if ("methods" in entry && entry.methods !== undefined) {
      if ("schema" in entry && entry.schema !== undefined)
        throw new InvalidDefinitionError(
          `Connection method "${id}" declares both schema and methods`,
        );
      const children = Object.entries(entry.methods);
      if (children.length === 0)
        throw new InvalidDefinitionError(
          `Connection method group "${id}" needs at least one sub-method`,
        );
      groupIds.push(id);
      const group = {
        id,
        label: entry.label,
        ...(entry.description ? { description: entry.description } : {}),
      };
      for (const [childId, child] of children) {
        assertMethodId(childId);
        assertLeaf(childId, child);
        methods.push({ ...child, id: childId, group });
      }
    } else if ("schema" in entry && entry.schema !== undefined) {
      assertLeaf(id, entry);
      methods.push({ ...entry, id });
    } else {
      throw new InvalidDefinitionError(
        `Connection method "${id}" needs a schema or methods`,
      );
    }
  }
  assertUnique(
    methods.map((method) => method.id),
    "connection method",
  );
  for (const groupId of groupIds) {
    if (methods.some((method) => method.id === groupId))
      throw new InvalidDefinitionError(
        `Connection method id "${groupId}" is used by both a method and a group`,
      );
  }
  return methods;
}

function assertMethodId(id: string): void {
  if (!KEBAB.test(id))
    throw new InvalidDefinitionError(
      `Connection method id must be kebab-case: ${id}`,
    );
}

function assertLeaf(
  id: string,
  entry: { label: string; description?: string; schema: unknown },
): void {
  if (!entry.label)
    throw new InvalidDefinitionError(
      `Connection method "${id}" requires a label`,
    );
  if (!(entry.schema instanceof z.ZodObject))
    throw new InvalidDefinitionError(
      `Connection method "${id}" schema must be a Zod object`,
    );
}

/**
 * Synthesizes the runtime connection schema from the declared methods.
 *
 * One method: the method's own schema is used directly, so single-method
 * adapters validate their fields without a `method` tag (and the form shows
 * no tabs). Several methods: a `z.discriminatedUnion("method", …)` where each
 * option is `{ method: z.literal(id), …fields }`.
 */
function connectionUnion(
  methods: readonly ConnectionMethodDefinition[] | undefined,
): z.ZodTypeAny | undefined {
  if (!methods || methods.length === 0) return undefined;
  if (methods.length === 1) return methods[0].schema;
  const options = methods.map((method) =>
    z.object({
      method: z.literal(method.id),
      ...(method.schema as z.ZodObject<z.ZodRawShape>).shape,
    }),
  );
  // Each option carries `method: z.literal(id)`, so the union discriminates
  // on `method`; the narrow cast is confined to this single generic boundary.
  return z.discriminatedUnion("method", options as never);
}

function assertUnique(ids: readonly string[], what: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id))
      throw new InvalidDefinitionError(`Duplicate adapter ${what}: ${id}`);
    seen.add(id);
  }
}
