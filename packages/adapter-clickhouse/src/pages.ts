import {
  Button,
  CodeBlock,
  Collection,
  definePage,
  Form,
  KeyValue,
  PageHeader,
  QueryEditor,
  ResourceTree,
  Section,
  SplitPane,
  Table,
  Tabs,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import { createDatabase, createDatabaseInput, runQuery } from "./actions.js";
import { overviewPage } from "./overview-page.js";

export { overviewPage } from "./overview-page.js";

import {
  columns,
  databases,
  ddl,
  inspections,
  isSystemView,
  preview,
  relations,
  systemViews,
  tableDetails,
} from "./resources.js";

function explorer(selectedPath: string) {
  return ResourceTree({
    label: "Data explorer",
    stateKey: "clickhouse-data-explorer",
    selectedPath,
    searchPlaceholder: "Search databases and tables…",
    branch: {
      source: databases(),
      nameField: "name",
      rowLink: { path: "/data/:database", params: { database: "name" } },
      children: {
        source: relations({ database: "$name" }),
        nameField: "name",
        typeField: "kind",
        rowLink: {
          path: "/data/:database/:table",
          params: { database: "database", table: "name" },
        },
        children: {
          source: columns({ database: "$database", table: "$name" }),
          nameField: "name",
        },
      },
    },
  });
}
export const dataPage = definePage({
  path: "/data",
  render: () =>
    SplitPane({
      sidebar: explorer("/data"),
      content: [
        PageHeader({
          title: "Data",
          description:
            "Metadata sizes and row counts are estimates; previews read up to 100 rows without FINAL.",
        }),
        Table({
          source: databases(),
          searchable: true,
          rowLink: { path: "/data/:database", params: { database: "name" } },
        }),
        Section({
          title: "Create database",
          content: Form({
            schema: createDatabaseInput,
            fields: [TextInput({ name: "name", label: "Database name" })],
            onSubmit: createDatabase,
            submitLabel: "Create database",
          }),
        }),
      ],
    }),
});
export const databasePage = definePage({
  path: "/data/:database",
  render: ({ params }) =>
    SplitPane({
      sidebar: explorer(`/data/${encodeURIComponent(params.database)}`),
      content: [
        PageHeader({
          title: params.database,
          description:
            "Tables, views, materialized views, and dictionary engines.",
        }),
        Button({
          label: "Query database",
          link: `/query/${encodeURIComponent(params.database)}`,
        }),
        Table({
          source: relations({ database: params.database }),
          searchable: true,
          rowLink: {
            path: "/data/:database/:table",
            params: { database: "database", table: "name" },
          },
        }),
      ],
    }),
});
export const tablePage = definePage({
  path: "/data/:database/:table",
  render: ({ params }) => {
    const input = { database: params.database, table: params.table };
    return SplitPane({
      sidebar: explorer(
        `/data/${encodeURIComponent(params.database)}/${encodeURIComponent(params.table)}`,
      ),
      content: [
        PageHeader({
          title: params.table,
          description: `${params.database} · Primary keys define ordering and do not enforce uniqueness.`,
        }),
        Tabs({
          items: [
            {
              label: "Preview (up to 100 rows)",
              content: Table({
                variant: "data",
                source: preview(input),
                columnsSource: columns(input),
              }),
            },
            {
              label: "Columns",
              content: Table({ source: columns(input), searchable: true }),
            },
            {
              label: "Details",
              content: KeyValue({ source: tableDetails(input) }),
            },
            {
              label: "DDL",
              content: Collection({
                source: ddl(input),
                content: CodeBlock({
                  label: "Create statement",
                  language: "sql",
                  value: { field: "ddl" },
                }),
              }),
            },
            ...[
              "parts",
              "projections",
              "data_skipping_indices",
              "mutations",
            ].flatMap((name) => {
              const resource = inspections.find(
                (item) => item.id === `inspect-${name}`,
              );
              return resource && isSystemView(name)
                ? [
                    {
                      label: systemViews[name].title,
                      content: Table({
                        source: resource(input),
                        searchable: true,
                      }),
                    },
                  ]
                : [];
            }),
          ],
        }),
      ],
    });
  },
});
function queryEditor(database?: string, sql?: string) {
  return QueryEditor({
    language: "sql",
    value: sql,
    action: { actionId: runQuery.id, input: { database } },
    database: { source: databases(), initialValue: database },
    explorer: {
      source: databases(),
      children: { source: relations({ database: "$name" }), typeField: "kind" },
    },
  });
}
export const queryPage = definePage({
  path: "/query",
  render: ({ query }) => [
    PageHeader({
      title: "Query editor",
      description:
        "One statement per run. Default limit: 1,000 rows, 16 MiB, 60 seconds. Requests do not share session state. Use Activity to cancel queries.",
    }),
    queryEditor(undefined, query.get("sql") ?? undefined),
  ],
});
export const databaseQueryPage = definePage({
  path: "/query/:database",
  render: ({ params, query }) => [
    PageHeader({
      title: `Query · ${params.database}`,
      description:
        "Use database.table for cross-database references. SQL runs with the configured database role.",
    }),
    queryEditor(params.database, query.get("sql") ?? undefined),
  ],
});
export const activityPage = definePage({
  path: "/activity",
  render: () => {
    const resource = inspections.find(
      (item) => item.id === "inspect-processes",
    );
    if (!resource) throw new Error("Missing activity resource");
    return [
      PageHeader({
        title: "Activity",
        description:
          "Queries visible on the connected endpoint; refreshed every five seconds. Cancellation requires server permission.",
      }),
      Table({
        source: resource({}),
        searchable: true,
        rowActions: [
          {
            label: "Cancel query",
            when: { field: "can_cancel", equals: 1 },
            action: "cancel-query",
            input: { queryId: "query_id" },
            variant: "danger",
            confirmation: {
              title: "Cancel this query?",
              description:
                "Request server-side termination by query ID. Writes already applied cannot be rolled back.",
              confirmLabel: "Cancel query",
            },
          },
        ],
      }),
    ];
  },
});
export const pages = [
  overviewPage,
  dataPage,
  databasePage,
  tablePage,
  queryPage,
  databaseQueryPage,
  activityPage,
];
