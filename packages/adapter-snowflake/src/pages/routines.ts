import {
  definePage,
  Form,
  PageHeader,
  Table,
  Tabs,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import {
  executeProcedure,
  executeProcedureInput,
} from "../actions/ingestion.js";
import { functions, procedures } from "../resources/routines.js";

export const routinesPage = definePage({
  path: "/routines/:database/:schema",
  render: ({ params }) => [
    PageHeader({
      title: `Routines in ${params.database}.${params.schema}`,
    }),
    Tabs({
      items: [
        {
          label: "Functions",
          content: Table({
            source: functions({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Procedures",
          content: Table({
            source: procedures({
              database: params.database,
              schema: params.schema,
            }),
          }),
        },
        {
          label: "Execute",
          content: Form({
            schema: executeProcedureInput,
            fields: [
              TextInput({ name: "name", label: "Procedure" }),
              TextInput({ name: "args", label: "Arguments" }),
            ],
            onSubmit: executeProcedure,
            submitLabel: "Execute procedure",
          }),
        },
      ],
    }),
  ],
});
