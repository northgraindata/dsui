import type {
  ActionBinding,
  ActionResult,
  ActionRuntimeContext,
} from "../action/index";
import type { AnyResourceDefinition } from "../resource/index";
import type { ActionExecutionOptions } from "./types";

/**
 * Owns action execution for one adapter instance. Every call runs the
 * action's `run` against an augmented context (original prototype
 * preserved, plus non-enumerable `invalidate` and `signal`) and returns
 * success or error. It never throws for `run` failures.
 */
export class ActionExecutor<TContext> {
  /**
   * @param context - The instance context actions run against.
   * @param invalidate - Bound instance invalidation, exposed on the
   * action context.
   */
  constructor(
    private readonly context: TContext,
    private readonly invalidate: (
      resource?: AnyResourceDefinition,
      input?: unknown,
    ) => void,
  ) {}

  /**
   * Executes an action binding.
   *
   * @param binding - Any context-specific binding is accepted; the
   * runtime supplies the augmented instance context.
   * @param options - Optional abort signal, delivered on the context.
   */
  async execute<TInput, TOutput>(
    binding: ActionBinding<TInput, TOutput, never>,
    options?: ActionExecutionOptions,
  ): Promise<ActionResult<TOutput>> {
    const actionContext = withRuntimeHelpers(
      this.context,
      this.invalidate,
      options?.signal,
    );
    const run = binding.definition.run as (
      input: unknown,
      ctx: unknown,
    ) => Promise<unknown> | unknown;
    try {
      options?.signal?.throwIfAborted();
      const data = (await run(binding.input, actionContext)) as TOutput;
      return { status: "success", data };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * Action context: the original object (prototype preserved) plus
 * runtime helpers as non-enumerable properties, so helpers never leak
 * into spreads or serialization of the context.
 */
function withRuntimeHelpers<TContext>(
  context: TContext,
  invalidate: (resource?: AnyResourceDefinition, input?: unknown) => void,
  signal?: AbortSignal,
): TContext & ActionRuntimeContext {
  const augmented = Object.create(
    context != null &&
      (typeof context === "object" || typeof context === "function")
      ? Object.getPrototypeOf(context)
      : Object.prototype,
  ) as Record<string, unknown>;
  if (
    context != null &&
    (typeof context === "object" || typeof context === "function")
  )
    Object.assign(augmented, context);
  Object.defineProperties(augmented, {
    invalidate: { enumerable: false, value: invalidate },
    signal: { enumerable: false, value: signal },
  });
  return augmented as TContext & ActionRuntimeContext;
}
