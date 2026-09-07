import { expect, test } from "bun:test";
import { z } from "zod";
import { InvalidDefinitionError } from "./errors";
import { assertNonEmptyId, parseBindingInput } from "./validators";

test("assertNonEmptyId accepts valid ids", () => {
  expect(() => assertNonEmptyId("Resource", "schemas")).not.toThrow();
});

test("assertNonEmptyId rejects empty ids", () => {
  expect(() => assertNonEmptyId("Action", "")).toThrow(InvalidDefinitionError);
  expect(() => assertNonEmptyId("Store", 42 as unknown as string)).toThrow(
    "Store id must be a non-empty string",
  );
});

test("parseBindingInput validates or passes through", () => {
  const schema = z.object({ limit: z.number().default(50) });
  expect(parseBindingInput(schema, {})).toEqual({ limit: 50 });
  expect(() => parseBindingInput(schema, { limit: "x" })).toThrow();
  expect(parseBindingInput(undefined, { anything: true })).toBeUndefined();
});
