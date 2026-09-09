import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { resumeTask, runTask, suspendTask } from "../actions/tasks.js";
import { taskDetails, taskHistory, tasks } from "../resources/tasks.js";

const taskInput = (params: {
  database: string;
  schema: string;
  task: string;
}) => ({
  database: params.database,
  schema: params.schema,
  task: params.task,
});

export const taskListPage = definePage({
  path: "/tasks/:database/:schema",
  render: ({ params }) => [
    PageHeader({ title: `Tasks in ${params.database}.${params.schema}` }),
    Table({
      source: tasks({ database: params.database, schema: params.schema }),
      rowLink: {
        path: `/tasks/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/:task`,
        params: { task: "name" },
      },
      rowActions: [
        {
          label: "Run now",
          action: runTask,
          input: { database: "database", schema: "schema", task: "name" },
        },
        {
          label: "Suspend",
          action: suspendTask,
          input: { database: "database", schema: "schema", task: "name" },
          when: { field: "status", equals: "STARTED" },
        },
        {
          label: "Resume",
          action: resumeTask,
          input: { database: "database", schema: "schema", task: "name" },
          when: { field: "status", notEquals: "STARTED" },
        },
      ],
    }),
  ],
});

export const taskDetailPage = definePage({
  path: "/tasks/:database/:schema/:task",
  render: ({ params }) => [
    PageHeader({
      title: `${params.database}.${params.schema}.${params.task}`,
    }),
    Tabs({
      items: [
        {
          label: "Details",
          content: KeyValue({ source: taskDetails(taskInput(params)) }),
        },
        {
          label: "Graph",
          content: KeyValue({
            title: "Dependencies",
            source: taskDetails(taskInput(params)),
          }),
        },
        {
          label: "History",
          content: Table({
            source: taskHistory(taskInput(params)),
          }),
        },
      ],
    }),
  ],
});
