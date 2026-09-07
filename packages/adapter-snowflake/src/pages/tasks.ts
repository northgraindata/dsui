import {
  Button,
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { resumeTask, runTask, suspendTask } from "../actions/tasks.js";
import type { TaskSummary } from "../context.js";
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
    Table<TaskSummary>({
      source: tasks({ database: params.database, schema: params.schema }),
      onRowClick: (row) =>
        `/tasks/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/${encodeURIComponent(row.name)}`,
      actions: (row) => [
        Button({
          label: "Run now",
          action: runTask(taskInput({ ...params, task: row.name })),
        }),
        row.status === "STARTED"
          ? Button({
              label: "Suspend",
              action: suspendTask(taskInput({ ...params, task: row.name })),
            })
          : Button({
              label: "Resume",
              action: resumeTask(taskInput({ ...params, task: row.name })),
            }),
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
