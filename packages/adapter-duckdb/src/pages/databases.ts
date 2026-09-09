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
  databases,
  overview,
  relations,
  schemas,
} from "../resources/catalog.js";
import { extensions } from "../resources/config.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "DuckDB",
      description:
        "Explore databases, inspect objects, and run SQL from one workspace.",
    }),
    KeyValue({ title: "Overview", source: overview() }),
    Tabs({
      items: [
        { label: "Databases", content: Table({ source: databases() }) },
        {
          label: "Loaded extensions",
          content: Table({
            source: extensions(),
            columns: [
              { id: "name", label: "Extension" },
              { id: "loaded", label: "Loaded" },
              { id: "version", label: "Version" },
            ],
          }),
        },
      ],
    }),
  ],
});

export const dataPage = definePage({
  path: "/data",
  render: () =>
    SplitPane({
      sidebar: dataExplorer("/data"),
      content: [
        PageHeader({
          title: "Data",
          description:
            "Browse DuckDB and attached databases from a single hierarchy.",
        }),
        KeyValue({
          title: "Explorer",
          data: {
            navigation: "Select a database, schema, table, or view.",
            search: "Search across the catalog from the explorer.",
          },
        }),
      ],
    }),
});

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
