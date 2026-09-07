import type { z } from "zod";
import { assertNonEmptyId, parseBindingInput } from "../shared/validators";
import type {
  ActionBinding,
  ActionDefinition,
  InputAction,
  InputlessAction,
} from "./types";

// NOTE: the input overload must come first (same reason as defineResource:
// TypeScript contextually types the `run` argument from the first overload).
/**
 * Defines an action with Zod-validated input.
 *
 * @param options.id - Unique within the adapter, e.g. `"suspend-warehouse"`.
 * @param options.input - Zod schema for binding input; drives both
 * validation and TypeScript inference of binding arguments.
 * @param options.run - Performs the side effect. Annotate the context as
 * `MyContext & ActionRuntimeContext` to see runtime helpers.
 * @returns A callable producing validated bindings (never executes).
 * @throws {@link InvalidDefinitionError} for empty ids.
 *
 * @example
 * ```ts
 * export const suspendWarehouse = defineAction({
 *   id: "suspend-warehouse",
 *   input: z.object({ warehouse: z.string() }),
 *   run: async ({ warehouse }, ctx: Ctx & ActionRuntimeContext) => {
 *     await ctx.client.suspendWarehouse(warehouse);
 *     ctx.invalidate(warehouses);
 *     return { warehouse, status: "SUSPENDED" };
 *   },
 * });
 * ```
 */
export function defineAction<
  TSchema extends z.ZodTypeAny,
  TOutput,
  TContext,
>(options: {
  id: string;
  input: TSchema;
  run: (input: z.output<TSchema>, ctx: TContext) => Promise<TOutput> | TOutput;
}): InputAction<z.input<TSchema>, TOutput, TContext>;
/**
 * Defines an action with no input.
 *
 * @param options.id - Unique within the adapter, e.g. `"flush"`.
 * @param options.run - Performs the side effect.
 * @returns A callable producing bindings (never executes).
 * @throws {@link InvalidDefinitionError} for empty ids.
 *
 * @example
 * ```ts
 * export const flush = defineAction({
 *   id: "flush",
 *   run: () => cache.clear(),
 * });
 * ```
 */
export function defineAction<TOutput, TContext>(options: {
  id: string;
  run: (input: undefined, ctx: TContext) => Promise<TOutput> | TOutput;
}): InputlessAction<TOutput, TContext>;
export function defineAction(options: {
  id: string;
  input?: z.ZodTypeAny;
  run: (input: never, ctx: never) => Promise<unknown> | unknown;
}): unknown {
  assertNonEmptyId("Action", options.id);
  const definition: ActionDefinition<unknown, unknown, unknown> = {
    kind: "action",
    id: options.id,
    inputSchema: options.input,
    run: options.run as (
      input: unknown,
      ctx: unknown,
    ) => Promise<unknown> | unknown,
  };
  const callable = (
    rawInput: unknown,
  ): ActionBinding<unknown, unknown, unknown> => {
    const input = parseBindingInput(definition.inputSchema, rawInput);
    return {
      kind: "action-binding",
      actionId: definition.id,
      input,
      definition,
    };
  };
  return Object.assign(callable, {
    kind: "action" as const,
    id: definition.id,
    definition,
  });
}
