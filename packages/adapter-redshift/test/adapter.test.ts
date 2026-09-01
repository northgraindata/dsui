import { expect, test } from "bun:test";
import adapter from "../src/index";

test("defaults Redshift connection values", () => {
  const parsed = adapter.connectionSchema.parse({
    host: "example.redshift.amazonaws.com",
    username: "admin",
    password: "secret",
  });
  expect(parsed.port).toBe(5439);
  expect(parsed.ssl).toBe(true);
});

test("exposes Redshift workload views", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toContain("query");
  expect(ids).toContain("workload");
});
