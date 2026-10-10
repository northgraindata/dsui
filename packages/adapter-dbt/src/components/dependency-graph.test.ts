import { expect, test } from "bun:test";
import { lookupComponent } from "../../../renderer/src/registry/component-lookup";
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
