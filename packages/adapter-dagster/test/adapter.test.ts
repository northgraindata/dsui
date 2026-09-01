import { expect, test } from "bun:test";
import adapter from "../src/index";

test("defaults Dagster token header", () => {
  const parsed = adapter.connectionSchema.parse({
    baseUrl: "http://dagster:3000",
  });
  expect(parsed.tokenHeader).toBe("Authorization");
});

test("covers Dagster operational concepts", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  for (const id of [
    "jobs",
    "runs",
    "assets",
    "schedules",
    "sensors",
    "backfills",
    "daemons",
    "resources",
    "graphql",
    "launch-run",
  ])
    expect(ids).toContain(id);
});
