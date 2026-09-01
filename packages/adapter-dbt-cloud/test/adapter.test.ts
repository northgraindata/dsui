import { expect, test } from "bun:test";
import adapter from "../src/index";

test("defaults the dbt Cloud US API origin", () => {
  const parsed = adapter.connectionSchema.parse({
    accountId: 42,
    token: "token",
  });
  expect(parsed.baseUrl).toBe("https://cloud.getdbt.com");
});

test("covers every dbt Cloud API v2 resource group", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  for (const id of [
    "connections",
    "environments",
    "invites",
    "jobs",
    "licenses",
    "notifications",
    "permissions",
    "projects",
    "repositories",
    "runs",
    "users",
  ])
    expect(ids).toContain(id);
  expect(ids).toContain("api-request");
});
