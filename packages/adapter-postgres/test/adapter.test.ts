import { expect, test } from "bun:test";
import adapter from "../src/index";

test("validates and defaults PostgreSQL connections", () => {
  const connection = adapter.connectionSchema.parse({ host: "postgres" });
  expect(connection.port).toBe(5432);
  expect(connection.database).toBe("postgres");
});

test("exposes PostgreSQL query and operations views", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toContain("query");
  expect(ids).toContain("active-queries");
  expect(ids).toContain("locks");
});
