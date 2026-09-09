import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { clearTask, retryTask } from "../actions/tasks.js";
import {
  dagRunDetails,
  taskInstanceDetails,
  taskInstances,
  taskLog,
} from "../resources/runs.js";

export const dagRunDetailPage = definePage({
  path: "/dags/:dagId/runs/:dagRunId",
  render: ({ params }) => {
    const input = { dagId: params.dagId, dagRunId: params.dagRunId };
    return [
      PageHeader({ title: params.dagRunId }),
      KeyValue({ source: dagRunDetails(input) }),
      Table({
        source: taskInstances(input),
        rowLink: {
          path: `/dags/${encodeURIComponent(params.dagId)}/runs/${encodeURIComponent(params.dagRunId)}/tasks/:taskId/:mapIndex/:tryNumber`,
          params: {
            taskId: "taskId",
            mapIndex: "mapIndex",
            tryNumber: "tryNumber",
          },
        },
        rowActions: [
          {
            label: "Retry",
            action: retryTask,
            input: {
              dagId: "dagId",
              dagRunId: "dagRunId",
              taskId: "taskId",
              mapIndex: "mapIndex",
              state: "state",
            },
            when: { field: "state", equals: "failed" },
          },
          {
            label: "Clear",
            action: clearTask,
            input: {
              dagId: "dagId",
              dagRunId: "dagRunId",
              taskId: "taskId",
              mapIndex: "mapIndex",
            },
            variant: "danger",
          },
        ],
      }),
    ];
  },
});

export const taskInstanceDetailPage = definePage({
  path: "/dags/:dagId/runs/:dagRunId/tasks/:taskId/:mapIndex/:tryNumber",
  render: ({ params }) => {
    const input = {
      dagId: params.dagId,
      dagRunId: params.dagRunId,
      taskId: params.taskId,
      mapIndex: Number(params.mapIndex),
    };
    return [
      PageHeader({ title: params.taskId }),
      Tabs({
        items: [
          {
            label: "Details",
            content: KeyValue({ source: taskInstanceDetails(input) }),
          },
          {
            label: `Log (try ${params.tryNumber})`,
            content: Table({
              source: taskLog({
                ...input,
                tryNumber: Number(params.tryNumber),
              }),
            }),
          },
        ],
      }),
    ];
  },
});
