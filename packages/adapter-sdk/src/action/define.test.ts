import { expect, test } from "bun:test";
import { z } from "zod";
import { defineAction } from "./define";

test("calling an action creates a binding without executing", () => {
  let calls = 0;
  const suspend = defineAction({
    id: "suspend-warehouse",
    input: z.object({ warehouse: z.string() }),
    run: () => {
      calls++;
      return "suspended";
    },
  });
  const binding = suspend({ warehouse: "ETL_WH" });
  expect(calls).toBe(0);
  expect(binding.kind).toBe("action-binding");
  expect(binding.actionId).toBe("suspend-warehouse");
  expect(binding.input).toEqual({ warehouse: "ETL_WH" });
});

test("action input is validated", () => {
  const resize = defineAction({
    id: "resize-warehouse",
    input: z.object({
      warehouse: z.string(),
      size: z.enum(["XSMALL", "SMALL", "MEDIUM", "LARGE"]),
    }),
    run: (input) => input.size,
  });
  expect(resize({ warehouse: "W", size: "MEDIUM" }).input).toEqual({
    warehouse: "W",
    size: "MEDIUM",
  });
  expect(() =>
    resize({ warehouse: "W", size: "HUGE" as unknown as "MEDIUM" }),
  ).toThrow();
});

test("inputless actions bind without arguments", () => {
  const flush = defineAction({ id: "flush", run: () => "ok" });
  expect(flush().input).toBeUndefined();
});

test("rejects empty action ids", () => {
  expect(() => defineAction({ id: "", run: () => 1 })).toThrow();
});
