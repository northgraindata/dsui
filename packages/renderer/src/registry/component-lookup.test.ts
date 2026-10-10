import { expect, test } from "bun:test";
import { lookupComponent } from "./component-lookup";

test("components with identical local paths resolve within their own adapter", () => {
  const entries = new Map([
    ["airflow:./dependency-graph-view.tsx", "airflow graph"],
    ["dbt:./dependency-graph-view.tsx", "dbt graph"],
    ["./dependency-graph-view.tsx", "last globally registered graph"],
    ["./ui/query-editor", "SDK query editor"],
  ]);
  expect(
    lookupComponent(
      entries,
      "airflow/dependency-graph",
      "./dependency-graph-view.tsx",
    ),
  ).toBe("airflow graph");
  expect(
    lookupComponent(
      entries,
      "dbt/dependency-graph",
      "./dependency-graph-view.tsx",
    ),
  ).toBe("dbt graph");
  expect(
    lookupComponent(
      entries,
      "external/dependency-graph",
      "./dependency-graph-view.tsx",
    ),
  ).toBeNull();
  expect(lookupComponent(entries, "query-editor", "./ui/query-editor")).toBe(
    "SDK query editor",
  );
});
