/**
 * Plugin actions, mirroring the adapter SDK's `defineAction`.
 *
 * A plugin's action is how the browser reaches plugin code: a component calls
 * the action, the host validates the input against the schema, and the handler
 * runs. The one addition over an adapter action is `permission`, because a
 * plugin such as auth decides its own authorization rather than inheriting it
 * from a service connection.
 */
import type { z } from "zod";
import { InvalidDefinitionError } from "./shared/errors";

/**
 * The access level a caller needs to invoke an action.
 *
 * - `"inspect"`: reads state, no mutation.
 * - `"execute"`: runs the plugin's work.
 * - `"manage"`: changes configuration, membership, or grants.
 */
export type PluginActionPermission = "inspect" | "execute" | "manage";

/** Browser-safe action reference used after page serialization. */
export type PluginActionReference = {
  readonly actionId: string;
  readonly input?: unknown;
};

/** An action definition, keeping the caller's context type. */
export type PluginActionDefinition<
  TContext,
  TInput = undefined,
  TOutput = unknown,
> = {
  readonly kind: "action";
  readonly id: string;
  readonly input?: z.ZodTypeAny;
  readonly output?: z.ZodTypeAny;
  readonly permission: PluginActionPermission;
  readonly run: (
    input: TInput,
    context: TContext,
  ) => TOutput | Promise<TOutput>;
};

/**
 * Defines an action the browser can invoke.
 *
 * @param options.id - Unique within the plugin, e.g. `"create-team"`.
 * @param options.input - Schema validating the caller's input.
 * @param options.output - Schema validating what the handler returns.
 * @param options.permission - Access level required to invoke.
 * @param options.run - The handler; receives validated input and the context.
 * @throws {@link InvalidDefinitionError} for an empty id.
 *
 * @example
 * ```ts
 * export const createTeam = defineAction({
 *   id: "create-team",
 *   input: z.object({ id: teamId, name: z.string().min(1) }),
 *   permission: "manage",
 *   run: async (input, ctx) => ctx.storage.run(...),
 * });
 * ```
 */
export function defineAction<
  TContext,
  TInputSchema extends z.ZodTypeAny = z.ZodUndefined,
  TOutput = unknown,
>(options: {
  id: string;
  input?: TInputSchema;
  output?: z.ZodType<TOutput, z.ZodTypeDef, any>;
  permission?: PluginActionPermission;
  run: (
    input: z.output<TInputSchema>,
    context: TContext,
  ) => TOutput | Promise<TOutput>;
}): PluginActionDefinition<TContext, z.output<TInputSchema>, TOutput> {
  if (!options.id)
    throw new InvalidDefinitionError("Action id must be a non-empty string");
  return {
    kind: "action",
    id: options.id,
    ...(options.input ? { input: options.input } : {}),
    ...(options.output ? { output: options.output } : {}),
    // A plugin that declares no permission still performs work, so the default
    // is `execute` rather than the read-only `inspect`.
    permission: options.permission ?? "execute",
    run: options.run,
  };
}
