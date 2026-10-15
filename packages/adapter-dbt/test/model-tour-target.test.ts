import { expect, test } from "bun:test";
import { modelDetailPage } from "../src/pages/model-detail";

test("model source tour target exists independently of resource loading", () => {
  const rendered = modelDetailPage.render({
    params: { modelId: "model.dsui_demo.fct_tour_orders" },
    query: new URLSearchParams(),
    stores: {
      use: () => {
        throw new Error("Unexpected store access");
      },
      get: () => {
        throw new Error("Unexpected store access");
      },
    },
  });
  const nodes = "kind" in rendered ? [rendered] : rendered;
  const target = nodes.find(
    (node) => node.kind === "custom" && node.props.component === "target",
  );
  expect(target).toMatchObject({
    kind: "custom",
    props: {
      component: "target",
      props: {
        id: "dbt.model.source",
        content: {
          kind: "resource",
          props: {
            source: {
              resourceId: "model-detail",
              input: { modelId: "model.dsui_demo.fct_tour_orders" },
            },
          },
        },
      },
    },
  });
});
