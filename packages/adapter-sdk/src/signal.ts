import type { z } from "zod";

/** Severity/category attached to a published signal. */
export type SignalType = "info" | "success" | "warning" | "error";

/** A typed event an adapter can publish to the DSUI event stream. */
export interface SignalDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly kind: "signal";
  readonly id: string;
  readonly type: SignalType;
  readonly schema: TSchema;
}

export type AnySignalDefinition = SignalDefinition<z.ZodTypeAny>;

export interface DefineSignalOptions<TSchema extends z.ZodTypeAny> {
  readonly id: string;
  readonly type: SignalType;
  readonly schema: TSchema;
}

/** Declares a validated, namespaced event emitted by an adapter job. */
export function defineSignal<TSchema extends z.ZodTypeAny>(
  options: DefineSignalOptions<TSchema>,
): SignalDefinition<TSchema> {
  if (!/^[a-z][a-z0-9-]*$/.test(options.id))
    throw new Error(`Signal id must be kebab-case, found "${options.id}"`);
  if (!options.schema || typeof options.schema.parse !== "function")
    throw new Error(`Signal "${options.id}" requires a Zod schema`);
  if (
    options.type !== "info" &&
    options.type !== "success" &&
    options.type !== "warning" &&
    options.type !== "error"
  )
    throw new Error(`Signal "${options.id}" has an invalid type`);
  return {
    kind: "signal",
    id: options.id,
    type: options.type,
    schema: options.schema,
  };
}
