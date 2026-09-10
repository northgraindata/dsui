import {
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import { relations } from "../resources/catalog.js";

export const schemaPage = definePage({
  path: "/data/:database/:schema",
  render: ({ params }) =>
    SplitPane({
      sidebar: dataExplorer(
        `/data/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}`,
      ),
      content: [
        PageHeader({
          title: params.schema,
          description: `${params.database} / ${params.schema}`,
        }),
        Tabs({
          items: [
            {
              label: "Objects",
              content: Table({
                source: relations({
                  database: params.database,
                  schema: params.schema,
                  type: "all",
                }),
                columns: [
                  { id: "name", label: "Name" },
                  { id: "type", label: "Type" },
                ],
                rowLink: {
                  path: "/data/:database/:schema/:relationType/:relation",
                  params: {
                    database: "database",
                    schema: "schema",
                    relationType: "relationType",
                    relation: "relation",
                  },
                },
              }),
            },
            {
              label: "Overview",
              content: KeyValue({
                data: { database: params.database, schema: params.schema },
              }),
            },
          ],
        }),
      ],
    }),
});
