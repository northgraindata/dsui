import { expect, test } from "bun:test";
import adapter from "../src/index";

test("requires a JobManager URL", () => {
  expect(() => adapter.connectionSchema.parse({})).toThrow();
});

test("defaults the JobManager URL", () => {
  const parsed = adapter.connectionSchema.parse({
    url: "http://flink:8081",
  });
  expect(parsed.url).toBe("http://flink:8081");
});

test("exposes inspect capabilities", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toContain("jobs");
  expect(ids).toContain("job-detail");
});
