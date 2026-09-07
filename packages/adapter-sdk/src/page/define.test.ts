import { expect, test } from "bun:test";
import { PageHeader } from "../components/index";
import { defineStore } from "../store/index";
import { definePage } from "./define";
import { matchRoute } from "./routing";

test("matchRoute extracts dynamic params", () => {
  expect(matchRoute("/databases/:database", "/databases/ANALYTICS")).toEqual({
    database: "ANALYTICS",
  });
  expect(
    matchRoute(
      "/databases/:database/schemas/:schema/tables/:table",
      "/databases/A/schemas/S/tables/T",
    ),
  ).toEqual({ database: "A", schema: "S", table: "T" });
});

test("matchRoute rejects non-matching urls", () => {
  expect(matchRoute("/databases/:database", "/warehouses/W")).toBeNull();
  expect(matchRoute("/databases/:database", "/databases")).toBeNull();
  expect(matchRoute("/databases", "/databases/X")).toBeNull();
});

test("definePage requires an absolute path", () => {
  expect(() => definePage({ path: "databases", render: () => [] })).toThrow();
  const page = definePage({
    path: "/databases/:database",
    render: ({ params }) => [PageHeader({ title: params.database })],
  });
  expect(page.path).toBe("/databases/:database");
});

test("definePage rejects duplicate store ids", () => {
  const store = defineStore({
    id: "filters",
    scope: "page",
    state: { search: "" },
    actions: ({ set }) => ({ setSearch: (search: string) => set({ search }) }),
  });
  expect(() =>
    definePage({ path: "/x", stores: [store, store], render: () => [] }),
  ).toThrow();
});
