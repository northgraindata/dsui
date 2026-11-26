import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { parseQueryResult } from "../../adapter-sdk/src/components/ui/query-editor/query-result";
import { queryResult } from "./query-result";
import { collectColumns } from "./render";
import { collectResourceTypes } from "./resource-types";
import { sampleFromType } from "./sample";

const root = resolve(import.meta.dir, "../../..");
const [postgresql] = collectResourceTypes(root, [
  join(root, "packages/adapter-postgresql"),
]);

function sample(rows: number, longText = false): unknown {
  const type = postgresql?.outputs.get("databases");
  if (!postgresql || !type) throw new Error("databases resource not found");
  return sampleFromType(postgresql.checker, type, {
    shape: { rows, longText },
    columns: [],
  });
}

test("samples follow the resource's output type deterministically", () => {
  const rows = sample(3) as Record<string, unknown>[];
  expect(rows).toHaveLength(3);
  expect(typeof rows[0]?.name).toBe("string");
  expect(typeof rows[0]?.allowConnections).toBe("boolean");
  expect(sample(3)).toEqual(rows);
});

test("shapes cover empty and long values", () => {
  expect(sample(0)).toEqual([]);
  const [row] = sample(1, true) as Record<string, string>[];
  expect(row?.name?.length).toBeGreaterThan(60);
});

test("table columns are collected from nested nodes", () => {
  const columns = new Map<string, Set<string>>();
  collectColumns(
    [{ props: { source: { resourceId: "a" }, columns: [{ id: "name" }] } }],
    columns,
  );
  expect([...(columns.get("a") ?? [])]).toEqual(["name"]);
});

test("fields read by value nodes are collected too", () => {
  const columns = new Map<string, Set<string>>();
  collectColumns(
    { props: { source: { resourceId: "overview" }, field: "size" } },
    columns,
  );
  expect([...(columns.get("overview") ?? [])]).toEqual(["size"]);
});

test("query results satisfy what the SQL editor accepts", () => {
  const result = parseQueryResult(queryResult({ rows: 3, longText: false }));
  expect(result.rows).toHaveLength(3);
  expect(result.columns.map((column) => column.name)).toContain("customer");
});

test("action outputs are collected from their run functions", () => {
  expect(postgresql?.actions.has("run-query")).toBe(true);
});
