import { expect, test } from "bun:test";
import adapter from "../src/index";

test("defaults Unity Catalog names", () => {
  const parsed = adapter.connectionSchema.parse({
    workspaceUrl: "https://example.cloud.databricks.com",
    token: "token",
    warehouseId: "warehouse",
  });
  expect(parsed.catalog).toBe("hive_metastore");
});

test("exposes Databricks SQL, jobs and pipelines", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toContain("query");
  expect(ids).toContain("pipelines");
  expect(ids).toContain("run-job");
});
