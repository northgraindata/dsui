import { expect, test } from "bun:test";
import adapter from "../src/index";

test("requires a server URL and catalog", () => {
  expect(() => adapter.connectionSchema.parse({})).toThrow();
  const connection = adapter.connectionSchema.parse({
    baseUrl: "http://polaris:8181",
    catalog: "default",
  });
  expect(connection.baseUrl).toBe("http://polaris:8181");
  expect(connection.catalog).toBe("default");
});

test("declares browse capabilities", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toEqual(
    expect.arrayContaining([
      "catalogs",
      "namespaces",
      "tables",
      "views",
      "metrics",
    ]),
  );
});
