import {
  Button,
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import { databaseSchemas } from "../resources/catalog.js";

export const databasePage = definePage({
  path: "/data/:database",
  render: ({ params }) =>
    SplitPane({
      sidebar: dataExplorer(`/data/${encodeURIComponent(params.database)}`),
      content: [
        PageHeader({
          title: params.database,
          description: "Database · select a schema to browse its objects.",
          actions: Button({
            label: "Open query",
            variant: "primary",
            link: `/query/${encodeURIComponent(params.database)}`,
          }),
        }),
        Tabs({
          items: [
            {
              label: "Overview",
              content: KeyValue({
                data: { database: params.database },
              }),
            },
            {
              label: "Schemas",
              content: Table({
                source: databaseSchemas({ database: params.database }),
                rowLink: {
                  path: "/data/:database/:schema",
                  params: { database: "database", schema: "name" },
                },
              }),
            },
          ],
        }),
      ],
    }),
});
