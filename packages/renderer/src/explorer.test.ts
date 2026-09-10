import { expect, test } from "bun:test";
import { selectFromRelation } from "./components/query-workbench/query-workbench";
import {
  resolveTreeLink,
  resolveTreeTemplate,
} from "./components/resource-tree";

test("resolves a child resource input from its parent row", () => {
  expect(
    resolveTreeTemplate(
      { database: "$database", schema: "$name", type: "all" },
      { database: "analytics", name: "marts" },
    ),
  ).toEqual({ database: "analytics", schema: "marts", type: "all" });
});

test("builds encoded relation links", () => {
  expect(
    resolveTreeLink(
      {
        path: "/data/:database/:schema/:relationType/:relation",
        params: {
          database: "database",
          schema: "schema",
          relationType: "relationType",
          relation: "name",
        },
      },
      {
        database: "local db",
        schema: "main",
        relationType: "tables",
        name: "order items",
      },
    ),
  ).toBe("/data/local%20db/main/tables/order%20items");
});

test("creates a safe preview query from an explorer relation", () => {
  expect(selectFromRelation(["memory", "main", 'odd"name'])).toBe(
    'SELECT *\nFROM "memory"."main"."odd""name"\nLIMIT 100;',
  );
});
