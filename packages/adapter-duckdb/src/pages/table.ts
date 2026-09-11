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
  columnProfile,
  tableColumns,
  tableDdl,
  tablePreview,
  viewDdl,
} from "../resources/catalog.js";

export const relationPage = definePage({
  path: "/data/:database/:schema/:relationType/:relation",
  render: ({ params }) => {
    const isView = params.relationType === "views";
    const input = {
      database: params.database,
      schema: params.schema,
      table: params.relation,
    };
    const commonTabs = [
      { label: "Preview", content: Table({ variant: "data", source: tablePreview(input), columnsSource: tableColumns(input) }) },
      { label: "Schema", content: Table({ source: tableColumns(input) }) },
      {
        label: "Details",
        content: KeyValue({
          data: {
            database: params.database,
            schema: params.schema,
            name: params.relation,
            type: isView ? "VIEW" : "TABLE",
          },
        }),
      },
    ];
    return SplitPane({
      sidebar: dataExplorer(
        `/data/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/${params.relationType}/${encodeURIComponent(params.relation)}`,
      ),
      content: [
        PageHeader({
          title: params.relation,
          description: `${params.database} / ${params.schema} / ${params.relation} · ${isView ? "VIEW" : "TABLE"}`,
        }),
        Tabs({
          items: isView
            ? [
                ...commonTabs,
                {
                  label: "DDL",
                  content: KeyValue({
                    source: viewDdl({
                      database: params.database,
                      schema: params.schema,
                      view: params.relation,
                    }),
                  }),
                },
              ]
            : [
                ...commonTabs,
                {
                  label: "Statistics",
                  content: Table({ source: columnProfile(input) }),
                },
                {
                  label: "DDL",
                  content: KeyValue({ source: tableDdl(input) }),
                },
              ],
        }),
      ],
      inspector: [
        KeyValue({
          title: "Table details",
          data: {
            schema: params.schema,
            name: params.relation,
            type: isView ? "VIEW" : "TABLE",
            database: params.database,
          },
        }),
        Table({
          source: tableColumns(input),
          columns: [
            { id: "name", label: "Columns" },
            { id: "type", label: "Type" },
          ],
        }),
        KeyValue({
          title: "Sample query",
          data: {
            SQL: `SELECT *\nFROM ${[params.database, params.schema, params.relation].map((name) => `"${name.replaceAll('"', '""')}"`).join(".")}\nLIMIT 100;`,
          },
        }),
      ],
    });
  },
});
