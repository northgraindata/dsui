import { expect, test } from "bun:test";
import {
  adapterTabsReducer,
  initialAdapterTabsState,
  visibleAdapterTabs,
} from "./adapter-tabs-state";

test("opening a service creates one tab and keeps its original position", () => {
  const first = adapterTabsReducer(initialAdapterTabsState, {
    type: "open",
    id: "duckdb",
  });
  const second = adapterTabsReducer(first, { type: "open", id: "postgres" });
  const duplicate = adapterTabsReducer(second, { type: "open", id: "duckdb" });
  expect(duplicate.openedIds).toEqual(["duckdb", "postgres"]);
});

test("reordering, splitting, and closing keep the remaining tabs usable", () => {
  const opened = ["duckdb", "postgres", "snowflake"].reduce(
    (state, id) => adapterTabsReducer(state, { type: "open", id }),
    initialAdapterTabsState,
  );
  const moved = adapterTabsReducer(opened, {
    type: "move",
    id: "snowflake",
    targetId: "duckdb",
    edge: "before",
  });
  expect(moved.openedIds).toEqual(["snowflake", "duckdb", "postgres"]);
  const split = adapterTabsReducer(moved, {
    type: "split",
    id: "postgres",
    targetId: "duckdb",
  });
  expect(split.split).toEqual({ leftId: "duckdb", rightId: "postgres" });
  expect(visibleAdapterTabs(split)).toEqual([
    { kind: "single", id: "snowflake" },
    { kind: "split", leftId: "duckdb", rightId: "postgres" },
  ]);
  expect(
    visibleAdapterTabs(adapterTabsReducer(split, { type: "unsplit" })),
  ).toEqual([
    { kind: "single", id: "snowflake" },
    { kind: "single", id: "duckdb" },
    { kind: "single", id: "postgres" },
  ]);
  const navigated = adapterTabsReducer(split, {
    type: "navigate-secondary",
    id: "postgres",
    path: "/query",
    search: "?limit=10",
  });
  expect(navigated.split).toEqual({
    leftId: "duckdb",
    rightId: "postgres",
    rightPath: "/query",
    rightSearch: "?limit=10",
  });
  const closed = adapterTabsReducer(navigated, {
    type: "close",
    id: "postgres",
  });
  expect(closed).toEqual({ openedIds: ["snowflake", "duckdb"] });
  expect(adapterTabsReducer(split, { type: "close-split" })).toEqual({
    openedIds: ["snowflake"],
  });
});
