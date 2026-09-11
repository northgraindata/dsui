import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
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
    Table({
      source: databases(),
      rowLink: { path: "/databases/:database", params: { database: "value" } },
    }),
  ],
});

export const databasePage = definePage({
  path: "/databases/:database",
  render: ({ params }) => [
    PageHeader({ title: params.database }),
    KeyValue({ source: databaseDetails({ database: params.database }) }),
    Table({
      source: schemas({ database: params.database }),
      rowLink: {
        path: `/databases/${encodeURIComponent(params.database)}/schemas/:schema`,
        params: { schema: "value" },
      },
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
          content: Table({
            source: tables({
              database: params.database,
              schema: params.schema,
            }),
            rowLink: {
              path: `/databases/${encodeURIComponent(params.database)}/schemas/${encodeURIComponent(params.schema)}/tables/:table`,
              params: { table: "value" },
            },
          }),
        },
        {
          label: "Views",
          content: Table({
            source: views({
              database: params.database,
              schema: params.schema,
            }),
            rowLink: {
              path: `/databases/${encodeURIComponent(params.database)}/schemas/${encodeURIComponent(params.schema)}/views/:view`,
              params: { view: "value" },
            },
          }),
        },
        {
          label: "Stages",
          content: Table({
            source: stages({
              database: params.database,
              schema: params.schema,
            }),
            rowLink: {
              path: `/stages/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/:stage`,
              params: { stage: "name" },
            },
          }),
        },
        {
          label: "Streams",
          content: Table({
            source: streams({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Dynamic Tables",
          content: Table({
            source: dynamicTables({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Sequences",
          content: Table({
            source: sequences({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Materialized",
          content: Table({
            source: materializedViews({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Formats",
          content: Table({
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
          { label: "Preview", content: Table({ variant: "data", source: tablePreview(input), columnsSource: tableColumns(input) }) },
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
