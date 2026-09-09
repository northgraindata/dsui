import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { pausePipe, resumePipe } from "../actions/ingestion.js";
import { pipes } from "../resources/ingestion.js";

export const pipesPage = definePage({
  path: "/pipes/:database/:schema",
  render: ({ params }) => [
    PageHeader({ title: `Pipes in ${params.database}.${params.schema}` }),
    Table({
      source: pipes({ database: params.database, schema: params.schema }),
      rowActions: [
        {
          label: "Pause",
          action: pausePipe,
          input: { database: "database", schema: "schema", pipe: "name" },
          when: { field: "status", equals: "RUNNING" },
        },
        {
          label: "Resume",
          action: resumePipe,
          input: { database: "database", schema: "schema", pipe: "name" },
          when: { field: "status", notEquals: "RUNNING" },
        },
      ],
    }),
  ],
});
