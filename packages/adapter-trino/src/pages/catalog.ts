import {
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import { schemas } from "../resources/index.js";

export const catalogPage = definePage({
  path: "/explorer/:catalog",
  render: ({ params }) =>
    SplitPane({
      sidebar: dataExplorer(`/explorer/${encodeURIComponent(params.catalog)}`),
      content: [
        PageHeader({
          title: params.catalog,
          description: "Catalog · select a schema to browse its objects.",
        }),
        Table({
          source: schemas({ catalog: params.catalog }),
          columns: [{ id: "name", label: "Schema" }],
          searchable: true,
          rowLink: {
            path: "/explorer/:catalog/:schema",
            params: { catalog: "catalog", schema: "name" },
          },
        }),
        KeyValue({
          title: "Catalog",
          data: { name: params.catalog, type: "Trino catalog" },
        }),
      ],
    }),
});
