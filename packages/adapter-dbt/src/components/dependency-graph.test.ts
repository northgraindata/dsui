import { expect, test } from "bun:test";
import * as React from "react";
import { lookupComponent } from "../../../renderer/src/registry/component-lookup";
import { createComponents } from "../browser";
import { DependencyGraph } from "./dependency-graph";

test("dbt graph declarations resolve to dbt when Airflow has the same module path", () => {
  const node = DependencyGraph({ idField: "id", dependsOnField: "dependsOn" });
  const entries = new Map([
    ["airflow:./dependency-graph-view.tsx", "Airflow"],
    ["dbt:./dependency-graph-view.tsx", "dbt"],
  ]);
  expect(lookupComponent(entries, node.props.component, node.props.path)).toBe(
    "dbt",
  );
});

test("dbt browser entry exports the declared dependency graph", () => {
  const node = DependencyGraph({ idField: "id", dependsOnField: "dependsOn" });
  const components = createComponents(React);
  expect(Object.keys(components)).toContain(node.props.component);
});
