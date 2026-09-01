import { expect, test } from "bun:test";
import adapter from "../src/index";

test("requires Snowflake account and token", () => {
  expect(() =>
    adapter.connectionSchema.parse({ accountIdentifier: "org-account" }),
  ).toThrow();
});

test("exposes Snowflake operational views", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toContain("warehouses");
  expect(ids).toContain("query-history");
});
