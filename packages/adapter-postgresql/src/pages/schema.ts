import {
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import { databaseRelations } from "../resources/catalog.js";

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
                source: databaseRelations({
                  database: params.database,
                  schema: params.schema,
                }),
                columns: [
                  { id: "name", label: "Name" },
                  { id: "kind", label: "Type" },
                  { id: "owner", label: "Owner" },
                  { id: "estimatedRows", label: "Estimated rows" },
                ],
                rowLink: {
                  path: "/data/:database/:schema/:relation",
                  params: {
                    database: "database",
                    schema: "schema",
                    relation: "name",
                  },
                },
                searchable: true,
                pageSize: 100,
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
