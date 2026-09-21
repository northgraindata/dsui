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
  databaseColumns,
  databaseConstraints,
  databaseIndexes,
} from "../resources/catalog.js";
import { databaseRelationPreviewRows } from "../resources/preview.js";

export const relationPage = definePage({
  path: "/data/:database/:schema/:relation",
  render: ({ params }) => {
    const input = {
      database: params.database,
      schema: params.schema,
      relation: params.relation,
    };
    const selectedPath = `/data/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/${encodeURIComponent(params.relation)}`;
    return SplitPane({
      sidebar: dataExplorer(selectedPath),
      content: [
        PageHeader({
          title: params.relation,
          description: `${params.database} / ${params.schema} / ${params.relation}`,
        }),
        Tabs({
          variant: "detail",
          items: [
            {
              label: "Preview",
              content: Table({
                source: databaseRelationPreviewRows({ ...input, maxRows: 100 }),
                variant: "data",
                pageSize: 100,
              }),
            },
            {
              label: "Columns",
              content: Table({
                source: databaseColumns(input),
                searchable: true,
                pageSize: 100,
              }),
            },
            {
              label: "Indexes",
              content: Table({
                source: databaseIndexes(input),
                searchable: true,
                pageSize: 100,
              }),
            },
            {
              label: "Constraints",
              content: Table({
                source: databaseConstraints(input),
                searchable: true,
                pageSize: 100,
              }),
            },
            {
              label: "Details",
              content: KeyValue({
                data: {
                  database: params.database,
                  schema: params.schema,
                  name: params.relation,
                },
              }),
            },
          ],
        }),
      ],
    });
  },
});
