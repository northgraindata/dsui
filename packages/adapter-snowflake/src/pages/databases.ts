import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import type { DynamicTableInfo, StageInfo, StreamInfo } from "../context.js";
import {
  databaseDetails,
  databases,
  fileFormats,
  materializedViews,
  schemas,
  sequences,
  tableColumns,
  tableDdl,
  tableDetails,
  tablePreview,
  tables,
  viewDetails,
  views,
} from "../resources/databases.js";
import {
  copyHistory,
  dynamicTables,
  stages,
  streams,
} from "../resources/ingestion.js";

export const databasesPage = definePage({
  path: "/databases",
  render: () => [
    PageHeader({ title: "Databases" }),
    Table<string>({
      source: databases(),
      onRowClick: (name) => `/databases/${encodeURIComponent(name)}`,
    }),
  ],
});

export const databasePage = definePage({
  path: "/databases/:database",
  render: ({ params }) => [
    PageHeader({ title: params.database }),
    KeyValue({ source: databaseDetails({ database: params.database }) }),
    Table<string>({
      source: schemas({ database: params.database }),
      onRowClick: (schema) =>
        `/databases/${encodeURIComponent(params.database)}/schemas/${encodeURIComponent(schema)}`,
    }),
  ],
});

export const schemaPage = definePage({
  path: "/databases/:database/schemas/:schema",
  render: ({ params }) => [
    PageHeader({ title: `${params.database}.${params.schema}` }),
    Tabs({
      items: [
        {
          label: "Tables",
          content: Table<string>({
            source: tables({
              database: params.database,
              schema: params.schema,
            }),
            onRowClick: (table) =>
              `/databases/${encodeURIComponent(params.database)}/schemas/${encodeURIComponent(params.schema)}/tables/${encodeURIComponent(table.split(".").pop() ?? table)}`,
          }),
        },
        {
          label: "Views",
          content: Table<string>({
            source: views({
              database: params.database,
              schema: params.schema,
            }),
            onRowClick: (view) =>
              `/databases/${encodeURIComponent(params.database)}/schemas/${encodeURIComponent(params.schema)}/views/${encodeURIComponent(view.split(".").pop() ?? view)}`,
          }),
        },
        {
          label: "Stages",
          content: Table<StageInfo>({
            source: stages({
              database: params.database,
              schema: params.schema,
            }),
            onRowClick: (row) =>
              `/stages/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/${encodeURIComponent(row.name)}`,
          }),
        },
        {
          label: "Streams",
          content: Table<StreamInfo>({
            source: streams({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Dynamic Tables",
          content: Table<DynamicTableInfo>({
            source: dynamicTables({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Sequences",
          content: Table<string>({
            source: sequences({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Materialized",
          content: Table<string>({
            source: materializedViews({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Formats",
          content: Table<string>({
            source: fileFormats({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
      ],
    }),
  ],
});

export const tablePage = definePage({
  path: "/databases/:database/schemas/:schema/tables/:table",
  render: ({ params }) => {
    const input = {
      database: params.database,
      schema: params.schema,
      table: params.table,
    };
    const title = `${params.database}.${params.schema}.${params.table}`;
    return [
      PageHeader({ title }),
      Tabs({
        items: [
          { label: "Preview", content: Table({ source: tablePreview(input) }) },
          { label: "Columns", content: Table({ source: tableColumns(input) }) },
          {
            label: "Details",
            content: KeyValue({ source: tableDetails(input) }),
          },
          { label: "DDL", content: KeyValue({ source: tableDdl(input) }) },
          {
            label: "Loads",
            content: Table({
              source: copyHistory({
                database: params.database,
                schema: params.schema,
                table: params.table,
              }),
            }),
          },
        ],
      }),
    ];
  },
});

export const viewPage = definePage({
  path: "/databases/:database/schemas/:schema/views/:view",
  render: ({ params }) => [
    PageHeader({
      title: `${params.database}.${params.schema}.${params.view}`,
    }),
    KeyValue({
      source: viewDetails({
        database: params.database,
        schema: params.schema,
        view: params.view,
      }),
    }),
  ],
});
