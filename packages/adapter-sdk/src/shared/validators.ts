import type { z } from "zod";
import { InvalidDefinitionError } from "./errors";

/**
 * Shared input validation for `defineX` constructors.
 *
 * Each validator throws {@link InvalidDefinitionError} with the exact
 * message adapters see. Checks used by a single caller stay inline in
 * that caller; only checks shared across concepts live here.
 */

/**
 * Rejects missing or non-string definition ids.
 *
 * @param kind - Capitalized concept name used in the message,
 * e.g. `"Resource"`.
 * @param id - The candidate id.
 * @throws {@link InvalidDefinitionError} when empty or not a string.
 *
 * @example
 * ```ts
 * assertNonEmptyId("Resource", options.id);
 * ```
 */
export function assertNonEmptyId(
  kind: "Resource" | "Action" | "Store",
  id: string,
): void {
  if (!id || typeof id !== "string")
    throw new InvalidDefinitionError(`${kind} id must be a non-empty string`);
}

/**
 * Parses raw binding input with the definition's schema, or returns
 * `undefined` for inputless definitions.
 *
 * @param inputSchema - The definition's Zod schema, if any.
 * @param rawInput - Caller-supplied input (already Zod-typed).
 * @returns Validated (and defaulted/coerced) input, or `undefined`.
 * @throws The schema's `ZodError` for invalid input.
 *
 * @example
 * ```ts
 * const input = parseBindingInput(definition.inputSchema, rawInput);
 * ```
 */
export function parseBindingInput(
  inputSchema: z.ZodTypeAny | undefined,
  rawInput: unknown,
): unknown {
  if (inputSchema == null) return undefined;
  return inputSchema.parse(rawInput);
}
