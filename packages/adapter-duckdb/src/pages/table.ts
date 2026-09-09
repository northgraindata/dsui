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
      {
        label: "Overview",
        content: KeyValue({
          data: {
            database: params.database,
            schema: params.schema,
            name: params.relation,
            type: isView ? "VIEW" : "TABLE",
          },
        }),
      },
      { label: "Data", content: Table({ source: tablePreview(input) }) },
      { label: "Columns", content: Table({ source: tableColumns(input) }) },
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
    });
  },
});
