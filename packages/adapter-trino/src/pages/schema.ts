import {
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import { relations } from "../resources/index.js";

export const schemaPage = definePage({
  path: "/explorer/:catalog/:schema",
  render: ({ params }) =>
    SplitPane({
      sidebar: dataExplorer(
        `/explorer/${encodeURIComponent(params.catalog)}/${encodeURIComponent(params.schema)}`,
      ),
      content: [
        PageHeader({
          title: params.schema,
          description: `${params.catalog} / ${params.schema}`,
        }),
        Table({
          source: relations({ catalog: params.catalog, schema: params.schema }),
          columns: [
            { id: "name", label: "Name" },
            { id: "type", label: "Type" },
          ],
          searchable: true,
          rowLink: {
            path: "/explorer/:catalog/:schema/:name/:type",
            params: {
              catalog: "catalog",
              schema: "schema",
              name: "name",
              type: "type",
            },
          },
        }),
        KeyValue({
          title: "Schema",
          data: { catalog: params.catalog, schema: params.schema },
        }),
      ],
    }),
});
