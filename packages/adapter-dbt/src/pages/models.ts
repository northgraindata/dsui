import {
  definePage,
  List,
  PageHeader,
  Tabs,
  Target,
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
          content: Target({
            id: "dbt.models.table",
            content: List({
              source: models(),
              noun: "model",
              searchable: true,
              pageSize: 50,
              filters: [
                { field: "materialized", label: "Materialized" },
                { field: "package", label: "Package" },
              ],
              item: {
                icon: "layers",
                title: "name",
                badge: "materialized",
                description: "description",
                meta: ["location", "upstreamLabel"],
              },
              rowLink: {
                path: "/models/:modelId",
                params: { modelId: "uniqueId" },
              },
            }),
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
