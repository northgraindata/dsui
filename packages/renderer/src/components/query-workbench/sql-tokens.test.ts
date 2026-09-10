import { expect, test } from "bun:test";
import { sqlTokens } from "./sql-tokens";

test("SQL highlighting preserves whitespace, escaped quotes and comments", () => {
  const sql =
    "SELECT 'it''s SELECT', \"FROM\", COUNT(*)\n-- LIMIT 10\nFROM orders;";
  const tokens = sqlTokens(sql);
  expect(tokens.map((token) => token.text).join("")).toBe(sql);
  expect(tokens).toContainEqual({ text: "'it''s SELECT'", kind: "string" });
  expect(tokens).toContainEqual({ text: '"FROM"', kind: "plain" });
  expect(tokens).toContainEqual({ text: "-- LIMIT 10", kind: "comment" });
  expect(tokens).toContainEqual({ text: "COUNT", kind: "function" });
});
