/**
 * Shared input validation for `defineX` constructors.
 *
 * Each validator throws {@link InvalidDefinitionError} with the message a
 * plugin author sees. Checks used by a single caller stay inline there; only
 * checks shared across concepts live here.
 */
import type { z } from "zod";
import { InvalidDefinitionError } from "./errors";

/**
 * Rejects missing or non-string definition ids.
 *
 * @param kind - Capitalized concept name used in the message.
 * @param id - The candidate id.
 * @throws {@link InvalidDefinitionError} when empty or not a string.
 *
 * @example
 * ```ts
 * assertNonEmptyId("Resource", options.id);
 * ```
 */
export function assertNonEmptyId(
  kind: "Resource" | "Action" | "Store" | "Page" | "Slot" | "Component",
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
 * @param rawInput - Caller-supplied input.
 * @returns Validated (and defaulted/coerced) input, or `undefined`.
 * @throws The schema's `ZodError` for invalid input.
 */
export function parseBindingInput(
  inputSchema: z.ZodTypeAny | undefined,
  rawInput: unknown,
): unknown {
  if (inputSchema == null) return undefined;
  return inputSchema.parse(rawInput);
}
