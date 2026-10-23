import { expect, test } from "bun:test";
import { defineResource } from "./define";

test("SQL policy survives definition and discovery without changing default resources", () => {
  const sql = defineResource({ id: "query", policy: "sql", query: () => [] });
  expect(sql.policy).toBe("sql");
  expect(sql.definition.policy).toBe("sql");
  expect(
    defineResource({ id: "normal", query: () => [] }).policy,
  ).toBeUndefined();
});
