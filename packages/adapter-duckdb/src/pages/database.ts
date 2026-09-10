import {
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import {
  databaseDetails,
  databaseSize,
  schemas,
} from "../resources/catalog.js";

export const databasePage = definePage({
  path: "/data/:database",
  render: ({ params }) =>
    SplitPane({
      sidebar: dataExplorer(`/data/${encodeURIComponent(params.database)}`),
      content: [
        PageHeader({
          title: params.database,
          description: "Database · select a schema to browse its objects.",
        }),
        Tabs({
          items: [
            {
              label: "Overview",
              content: [
                KeyValue({
                  source: databaseDetails({ database: params.database }),
                }),
                KeyValue({
                  title: "Storage",
                  source: databaseSize({ database: params.database }),
                }),
              ],
            },
            {
              label: "Schemas",
              content: Table({
                source: schemas({ database: params.database }),
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
