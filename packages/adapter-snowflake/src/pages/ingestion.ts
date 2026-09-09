import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import {
  resumeDynamicTable,
  suspendDynamicTable,
} from "../actions/ingestion.js";
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
    Table({
      source: stages({ database: params.database, schema: params.schema }),
      rowLink: {
        path: `/stages/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/:stage`,
        params: { stage: "name" },
      },
    }),
  ],
});

export const stageFilesPage = definePage({
  path: "/stages/:database/:schema/:stage",
  render: ({ params }) => [
    PageHeader({ title: `@${params.stage}` }),
    Table({
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
    Table({
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
    Table({
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
    Table({
      source: dynamicTables({
        database: params.database,
        schema: params.schema,
      }),
      rowActions: [
        {
          label: "Suspend",
          action: suspendDynamicTable,
          input: { database: "database", schema: "schema", name: "name" },
          when: { field: "status", equals: "ACTIVE" },
        },
        {
          label: "Resume",
          action: resumeDynamicTable,
          input: { database: "database", schema: "schema", name: "name" },
          when: { field: "status", notEquals: "ACTIVE" },
        },
      ],
    }),
  ],
});
