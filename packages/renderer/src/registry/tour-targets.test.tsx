import { expect, test } from "bun:test";
import type { ComponentClient } from "@northgraindata/dsui-adapter-sdk";
import { renderToStaticMarkup } from "react-dom/server";
import { DependencyGraph } from "../../../adapter-airflow/src/components/dependency-graph";
import { DependencyGraphView } from "../../../adapter-airflow/src/components/dependency-graph-view";
import { Target } from "../../../adapter-sdk/src/components/primitives/target";
import TargetView from "../../../adapter-sdk/src/components/ui/target";

const client: ComponentClient = {
  executeResource: async () => {
    throw new Error("Service unavailable");
  },
  executeAction: async () => ({ status: "error" }),
  navigate: () => {
    throw new Error("Unexpected navigation");
  },
};

test("Airflow tour anchor remains visible while graph data is unavailable", () => {
  const html = renderToStaticMarkup(
    <DependencyGraphView
      client={client}
      node={DependencyGraph({
        source: {
          kind: "resource-binding",
          resourceId: "dag-graph",
          input: { dagId: "demo_pipeline" },
        },
        idField: "id",
        dependsOnField: "upstream",
      })}
    />,
  );
  expect(html).toContain('data-dsui-overlay-target="airflow.dag.graph"');
  expect(html).toContain("Loading graph");
});

test("a tour target exposes resource errors without removing its anchor", () => {
  const html = renderToStaticMarkup(
    <TargetView
      client={client}
      node={Target({
        id: "dbt.model.source",
        content: {
          kind: "resource",
          props: { source: { resourceId: "model-detail" }, content: [] },
        },
      })}
      renderNode={() => <p role="alert">Model not found</p>}
    />,
  );
  expect(html).toContain('data-dsui-overlay-target="dbt.model.source"');
  expect(html).toContain('role="alert"');
  expect(html).toContain("Model not found");
});
