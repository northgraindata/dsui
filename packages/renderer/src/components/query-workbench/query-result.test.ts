import { expect, test } from "bun:test";
import { parseQueryResult, queryCsv } from "./query-result";

test("preserves column names and database types for empty results", () => {
  expect(
    parseQueryResult({
      columns: ["created_at"],
      columnTypes: ["TIMESTAMP"],
      rows: [],
      elapsedMs: 4,
    }),
  ).toEqual({
    columns: [{ name: "created_at", type: "TIMESTAMP" }],
    rows: [],
    elapsedMs: 4,
  });
});
test("does not invent SQL types for legacy results", () => {
  expect(parseQueryResult({ rows: [{ count: "142" }] }).columns).toEqual([
    { name: "count" },
  ]);
});
test("rejects malformed result rows instead of rendering empty success", () => {
  expect(() => parseQueryResult({ rows: "oops" })).toThrow(
    "Invalid query result",
  );
  expect(() => parseQueryResult({ rows: [null] })).toThrow(
    "Invalid query result",
  );
});
test("CSV preserves column order and escapes delimiters, quotes and newlines", () => {
  expect(
    queryCsv(
      parseQueryResult({
        columns: ["name", "note"],
        rows: [{ note: 'a,"b"\nc', name: "Ada" }],
      }),
    ),
  ).toBe('name,note\r\nAda,"a,""b""\nc"');
});
test("CSV neutralizes spreadsheet formulas in string cells", () => {
  expect(
    queryCsv(
      parseQueryResult({
        rows: [{ value: "=1+1" }, { value: -5 }, { value: null }],
      }),
    ),
  ).toBe("value\r\n'=1+1\r\n-5\r\n");
});
