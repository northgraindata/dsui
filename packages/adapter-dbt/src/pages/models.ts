import {
  definePage,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { DependencyGraph } from "../components/dependency-graph.js";
import { models } from "../resources/artifacts.js";

export const modelsPage = definePage({
  path: "/models",
  render: () => [
    PageHeader({
      title: "Models",
      description: "Models from manifest.json.",
    }),
    Tabs({
      items: [
        {
          label: "List",
          content: Table({
            source: models(),
            columns: [
              { id: "uniqueId", label: "ID" },
              { id: "name", label: "Model" },
              { id: "package", label: "Package" },
              { id: "database", label: "Database" },
              { id: "schema", label: "Schema" },
              { id: "materialized", label: "Materialized" },
              { id: "dependsOn", label: "Upstream models" },
            ],
            rowLink: {
              path: "/models/:modelId",
              params: { modelId: "uniqueId" },
            },
            searchable: true,
          }),
        },
        {
          label: "Lineage",
          content: DependencyGraph({
            source: models(),
            idField: "uniqueId",
            dependsOnField: "dependsOn",
            labelField: "name",
            detailField: "materialized",
          }),
        },
      ],
    }),
  ],
});
