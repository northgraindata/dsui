import { expect, test } from "bun:test";
import { z } from "zod";
import { defineResource } from "./define";

test("calling a resource creates a binding without executing", () => {
  let calls = 0;
  const schemas = defineResource({
    id: "schemas",
    input: z.object({ database: z.string() }),
    query: ({ database }) => {
      calls++;
      return [`${database}.PUBLIC`];
    },
  });
  const binding = schemas({ database: "ANALYTICS" });
  expect(calls).toBe(0);
  expect(binding.kind).toBe("resource-binding");
  expect(binding.resourceId).toBe("schemas");
  expect(binding.input).toEqual({ database: "ANALYTICS" });
});

test("resource input is validated and parsed", () => {
  const schemas = defineResource({
    id: "schemas",
    input: z.object({ database: z.string(), limit: z.number().default(50) }),
    query: (input) => input,
  });
  expect(schemas({ database: "A" }).input).toEqual({
    database: "A",
    limit: 50,
  });
  expect(() => schemas({ database: 123 as unknown as string })).toThrow();
});

test("inputless resources default to manual refresh", () => {
  let calls = 0;
  const warehouses = defineResource({
    id: "warehouses",
    query: () => {
      calls++;
      return ["WH1"];
    },
  });
  const binding = warehouses();
  expect(binding.input).toBeUndefined();
  expect(warehouses.refresh).toEqual({ kind: "manual" });
  expect(calls).toBe(0);
});

test("refresh strategy is stored on the definition", () => {
  const warehouses = defineResource({
    id: "warehouses",
    query: () => [] as string[],
    refresh: { kind: "poll", intervalMs: 5000 },
  });
  expect(warehouses.refresh).toEqual({ kind: "poll", intervalMs: 5000 });
});

test("rejects empty resource ids", () => {
  expect(() => defineResource({ id: "", query: () => 1 })).toThrow();
});
