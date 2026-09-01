import { expect, test } from "bun:test";
import adapter from "../src/index";

test("defaults BigQuery location", () => {
  const parsed = adapter.connectionSchema.parse({
    projectId: "analytics",
    accessToken: "token",
  });
  expect(parsed.location).toBe("US");
});

test("exposes BigQuery data and job views", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toContain("query");
  expect(ids).toContain("jobs");
});
