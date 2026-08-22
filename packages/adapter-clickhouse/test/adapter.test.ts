import { expect, test } from "bun:test";
import adapter from "../src/index";

test("applies ClickHouse connection defaults", () => {
  const connection = adapter.connectionSchema.parse({ host: "localhost" });
  expect(connection.port).toBe(8123);
  expect(connection.username).toBe("default");
  expect(connection.database).toBeUndefined();
  expect(connection.protocol).toBe("http");
});

test("accepts an optional default database", () => {
  const withDb = adapter.connectionSchema.parse({
    host: "localhost",
    database: "analytics",
  });
  expect(withDb.database).toBe("analytics");
  const withoutDb = adapter.connectionSchema.parse({ host: "localhost" });
  expect(withoutDb.database).toBeUndefined();
});

test("requires a host", () => {
  expect(() => adapter.connectionSchema.parse({})).toThrow();
});

test("declares a bounded query capability", () => {
  expect(
    adapter.capabilities.find((capability) => capability.id === "query")?.view
      .dialect,
  ).toBe("clickhouse");
});
