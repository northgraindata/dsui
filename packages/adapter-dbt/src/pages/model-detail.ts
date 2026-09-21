import {
  CodeBlock,
  definePage,
  KeyValue,
  PageHeader,
  Resource,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { DependencyGraph } from "../components/dependency-graph.js";
import {
  modelColumns,
  modelDetail,
  modelLineage,
} from "../resources/artifacts.js";

export const modelDetailPage = definePage({
  path: "/models/:modelId",
  render: ({ params }) => {
    const input = { modelId: params.modelId };
    return [
      PageHeader({
        title: params.modelId,
        description: "Model metadata from manifest.json.",
      }),
      KeyValue({ title: "Model", source: modelDetail(input) }),
      DependencyGraph({
        source: modelLineage(input),
        idField: "graphId",
        dependsOnField: "upstreamGraphIds",
        labelField: "name",
        detailField: "detail",
        stateField: "state",
      }),
      Table({
        source: modelColumns(input),
        columns: [
          { id: "name", label: "Column" },
          { id: "dataType", label: "Data type" },
          { id: "description", label: "Description" },
        ],
      }),
      Resource({
        source: modelDetail(input),
        content: CodeBlock({
          label: "Compiled SQL",
          value: { field: "compiledCode" },
          language: "sql",
        }),
      }),
    ];
  },
});
