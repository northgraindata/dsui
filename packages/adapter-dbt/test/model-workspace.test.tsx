import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  filterModels,
  ModelCatalogContent,
} from "../src/components/model-catalog-view";
import { ModelWorkspaceContent } from "../src/components/model-workspace-view";
import {
  type ModelDetail,
  type ModelRow,
  modelDetailSchema,
  modelRowSchema,
} from "../src/components/workspace-shared";
import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
const models: ModelRow[] = [
  {
    uniqueId: "model.p.orders",
    name: "orders",
    package: "p",
    database: "warehouse",
    schema: "marts",
    materialized: "incremental",
    description: "Daily commerce facts",
    dependsOn: ["model.p.stg_orders"],
    location: "warehouse.marts",
    upstreamLabel: "1 upstream",
  },
  {
    uniqueId: "model.p.stg_orders",
    name: "stg_orders",
    package: "p",
    database: "warehouse",
    schema: "staging",
    materialized: "view",
    description: "Source order records",
    dependsOn: [],
    location: "warehouse.staging",
    upstreamLabel: "No upstream",
  },
];
const client: ComponentProps["client"] = {
  executeResource: async () => [],
  executeAction: async () => ({ status: "success" }),
  navigate: () => {},
  resolveHref: (path) => `/services/dbt${path}`,
};
const renderNode: ComponentProps["renderNode"] = () => null;
test("model search combines description/location with materialization and package without changing source order", () => {
  expect(
    filterModels(models, "COMMERCE", "incremental", "p").map(
      (model) => model.name,
    ),
  ).toEqual(["orders"]);
  expect(
    filterModels(models, "warehouse.staging", "view", "p").map(
      (model) => model.name,
    ),
  ).toEqual(["stg_orders"]);
  expect(filterModels(models, "orders", "table", "")).toEqual([]);
  expect(models.map((model) => model.name)).toEqual(["orders", "stg_orders"]);
});
test("catalog presents comparable model attributes and an actionable empty state", () => {
  for (const model of models)
    expect(modelRowSchema.parse(model)).toEqual(model);
  const html = renderToStaticMarkup(
    <ModelCatalogContent
      client={client}
      renderNode={renderNode}
      models={models}
      source={{ resourceId: "models" }}
    />,
  );
  expect(html).not.toContain(">Materialization</th>");
  expect(html).not.toContain(">Package</th>");
  expect(html).toContain("Dependencies");
  expect(html).toContain("Open upstream model stg_orders");
  expect(html).toContain('href="/services/dbt/models/model.p.orders"');
  expect(html).toContain('data-kind="incremental"');
  expect(html).toContain("Location");
  expect(html).toContain("incremental");
  expect(html).toContain("Daily commerce facts");
  const empty = renderToStaticMarkup(
    <ModelCatalogContent
      client={client}
      renderNode={renderNode}
      models={[]}
      source={{ resourceId: "models" }}
    />,
  );
  expect(empty).toContain("No models available");
  expect(empty).toContain("manifest.json");
});
test("model defaults to documented columns while SQL stays behind its tabs", () => {
  const model: ModelDetail = {
    uniqueId: "model.p.orders",
    name: "orders",
    description: "Daily commerce facts",
    database: "warehouse",
    schema: "marts",
    alias: "fact_orders",
    rawCode: "select PRIVATE_RAW_SQL",
    compiledCode: "select PRIVATE_COMPILED_SQL",
    dependencies: ["model.p.stg_orders"],
    columns: [
      {
        name: "order_id",
        dataType: "BIGINT",
        description: "Primary order identifier",
      },
    ],
  };
  expect(modelDetailSchema.parse(model)).toEqual(model);
  const html = renderToStaticMarkup(
    <ModelWorkspaceContent
      client={client}
      renderNode={renderNode}
      model={model}
      lineageSource={{ resourceId: "model-lineage" }}
    />,
  );
  expect(html).toContain("warehouse.marts.fact_orders");
  expect(html).toContain("Primary order identifier");
  expect(html).toContain("Source SQL");
  expect(html).toContain("Compiled SQL");
  expect(html).not.toContain("PRIVATE_RAW_SQL");
  expect(html).not.toContain("PRIVATE_COMPILED_SQL");
  expect(html).not.toContain("rawCode");
});
