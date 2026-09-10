import { expect, test } from "bun:test";
import type { EntityItem } from "@northgraindata/dsui-core";
import { filterEntities } from "./entity-hooks";

const items: EntityItem[] = [
  {
    id: "a",
    title: "HTTP files",
    description: "Cloud storage",
    category: "Storage",
    attributes: { installed: true, provenance: "Official" },
  },
  {
    id: "b",
    title: "Search",
    description: "Full text",
    category: "Analytics",
    attributes: { installed: false, provenance: "Community" },
  },
];
test("catalog combines category, text, and attribute filters without changing source rows", () => {
  expect(
    filterEntities(items, " CLOUD ", "Storage", {
      label: "Installed",
      field: "installed",
      equals: true,
    }),
  ).toEqual([items[0]]);
  expect(filterEntities(items, "cloud", "Analytics")).toEqual([]);
  expect(
    filterEntities(items, "", "", {
      label: "Community",
      field: "provenance",
      equals: "Community",
    }),
  ).toEqual([items[1]]);
  expect(items).toHaveLength(2);
});
