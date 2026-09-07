import type { z } from "zod";
import { manual, type RefreshStrategy } from "../refresh/index";
import { assertNonEmptyId, parseBindingInput } from "../shared/validators";
import type {
  InputlessResource,
  InputResource,
  ResourceBinding,
  ResourceDefinition,
} from "./types";

// NOTE: the input overload must come first. TypeScript contextually types
// the `query` argument from the first overload, and the schema overload
// provides `any`-compatible contextual types before inference resolves.
/**
 * Defines a resource with Zod-validated input.
 *
 * @param options.id - Unique within the adapter, e.g. `"schemas"`.
 * @param options.input - Zod schema for binding input; drives both
 * validation and TypeScript inference of binding arguments.
 * @param options.query - Fetches the data from validated input and context.
 * @param options.refresh - Freshness declaration; defaults to `manual()`.
 * @returns A callable producing validated bindings (never executes).
 * @throws {@link InvalidDefinitionError} for empty ids.
 *
 * @example
 * ```ts
 * export const schemas = defineResource({
 *   id: "schemas",
 *   input: z.object({ database: z.string() }),
 *   query: ({ database }, ctx: SnowflakeContext) =>
 *     ctx.client.listSchemas(database),
 *   refresh: poll("60s"),
 * });
 * ```
 */
export function defineResource<
  TSchema extends z.ZodTypeAny,
  TOutput,
  TContext,
>(options: {
  id: string;
  input: TSchema;
  query: (
    input: z.output<TSchema>,
    ctx: TContext,
  ) => Promise<TOutput> | TOutput;
  refresh?: RefreshStrategy;
}): InputResource<z.input<TSchema>, TOutput, TContext>;
/**
 * Defines a resource with no input.
 *
 * @param options.id - Unique within the adapter, e.g. `"warehouses"`.
 * @param options.query - Fetches the data from the adapter context.
 * @param options.refresh - Freshness declaration; defaults to `manual()`.
 * @returns A callable producing bindings (never executes).
 * @throws {@link InvalidDefinitionError} for empty ids.
 *
 * @example
 * ```ts
 * export const warehouses = defineResource({
 *   id: "warehouses",
 *   query: (_, ctx: SnowflakeContext) => ctx.client.listWarehouses(),
 *   refresh: poll("5s"),
 * });
 * ```
 */
export function defineResource<TOutput, TContext>(options: {
  id: string;
  query: (input: undefined, ctx: TContext) => Promise<TOutput> | TOutput;
  refresh?: RefreshStrategy;
}): InputlessResource<TOutput, TContext>;
export function defineResource(options: {
  id: string;
  input?: z.ZodTypeAny;
  query: (input: never, ctx: never) => Promise<unknown> | unknown;
  refresh?: RefreshStrategy;
}): unknown {
  assertNonEmptyId("Resource", options.id);
  const definition: ResourceDefinition<unknown, unknown, unknown> = {
    kind: "resource",
    id: options.id,
    inputSchema: options.input,
    query: options.query as (
      input: unknown,
      ctx: unknown,
    ) => Promise<unknown> | unknown,
    refresh: options.refresh ?? manual(),
  };
  const callable = (
    rawInput: unknown,
  ): ResourceBinding<unknown, unknown, unknown> => {
    const input = parseBindingInput(definition.inputSchema, rawInput);
    return {
      kind: "resource-binding",
      resourceId: definition.id,
      input,
      definition,
    };
  };
  return Object.assign(callable, {
    kind: "resource" as const,
    id: definition.id,
    refresh: definition.refresh,
    definition,
  });
}
