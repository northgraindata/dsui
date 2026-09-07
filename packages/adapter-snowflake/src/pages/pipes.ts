import {
  Button,
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { pausePipe, resumePipe } from "../actions/ingestion.js";
import type { PipeInfo } from "../context.js";
import { pipes } from "../resources/ingestion.js";

export const pipesPage = definePage({
  path: "/pipes/:database/:schema",
  render: ({ params }) => [
    PageHeader({ title: `Pipes in ${params.database}.${params.schema}` }),
    Table<PipeInfo>({
      source: pipes({ database: params.database, schema: params.schema }),
      actions: (row) =>
        row.status === "RUNNING"
          ? Button({
              label: "Pause",
              action: pausePipe({
                database: params.database,
                schema: params.schema,
                pipe: row.name,
              }),
            })
          : Button({
              label: "Resume",
              action: resumePipe({
                database: params.database,
                schema: params.schema,
                pipe: row.name,
              }),
            }),
    }),
  ],
});
