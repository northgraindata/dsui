import {
  Button,
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import {
  resumeDynamicTable,
  suspendDynamicTable,
} from "../actions/ingestion.js";
import type {
  CopyHistoryEntry,
  DynamicTableInfo,
  StageFile,
  StageInfo,
  StreamInfo,
} from "../context.js";
import {
  copyHistory,
  dynamicTables,
  stageFiles,
  stages,
  streams,
} from "../resources/ingestion.js";

export const stagesPage = definePage({
  path: "/stages/:database/:schema",
  render: ({ params }) => [
    PageHeader({ title: `Stages in ${params.database}.${params.schema}` }),
    Table<StageInfo>({
      source: stages({ database: params.database, schema: params.schema }),
      onRowClick: (row) =>
        `/stages/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/${encodeURIComponent(row.name)}`,
    }),
  ],
});

export const stageFilesPage = definePage({
  path: "/stages/:database/:schema/:stage",
  render: ({ params }) => [
    PageHeader({ title: `@${params.stage}` }),
    Table<StageFile>({
      source: stageFiles({
        database: params.database,
        schema: params.schema,
        stage: params.stage,
      }),
    }),
  ],
});

export const streamsPage = definePage({
  path: "/streams/:database/:schema",
  render: ({ params }) => [
    PageHeader({ title: `Streams in ${params.database}.${params.schema}` }),
    Table<StreamInfo>({
      source: streams({ database: params.database, schema: params.schema }),
    }),
  ],
});

export const copyHistoryPage = definePage({
  path: "/copy-history/:database/:schema",
  render: ({ params }) => [
    PageHeader({
      title: `Copy history in ${params.database}.${params.schema}`,
    }),
    Table<CopyHistoryEntry>({
      source: copyHistory({
        database: params.database,
        schema: params.schema,
        table: null,
      }),
    }),
  ],
});

export const dynamicTablesPage = definePage({
  path: "/dynamic-tables/:database/:schema",
  render: ({ params }) => [
    PageHeader({
      title: `Dynamic tables in ${params.database}.${params.schema}`,
    }),
    Table<DynamicTableInfo>({
      source: dynamicTables({
        database: params.database,
        schema: params.schema,
      }),
      actions: (row) =>
        row.status === "ACTIVE"
          ? Button({
              label: "Suspend",
              action: suspendDynamicTable({
                database: params.database,
                schema: params.schema,
                name: row.name,
              }),
            })
          : Button({
              label: "Resume",
              action: resumeDynamicTable({
                database: params.database,
                schema: params.schema,
                name: row.name,
              }),
            }),
    }),
  ],
});
