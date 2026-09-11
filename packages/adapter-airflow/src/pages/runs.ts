import {
  Button,
  DependencyGraph,
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { triggerDag } from "../actions/dags.js";
import { clearTask, retryTask } from "../actions/tasks.js";
import {
  dagRunDetails,
  taskInstanceDetails,
  taskInstanceGraph,
  taskInstances,
  taskLog,
} from "../resources/runs.js";

export const dagRunDetailPage = definePage({
  path: "/dags/:dagId/runs/:dagRunId",
  render: ({ params }) => {
    const input = { dagId: params.dagId, dagRunId: params.dagRunId };
    return [
      PageHeader({
        title: params.dagRunId,
        description: "Review run state and manage individual task instances.",
      }),
      Button({
        label: "Trigger new run",
        icon: "play",
        variant: "primary",
        action: triggerDag({ dagId: params.dagId, conf: {} }),
        successLink: {
          path: "/dags/:dagId/runs/:dagRunId",
          params: { dagId: "dagId", dagRunId: "dagRunId" },
        },
      }),
      Tabs({
        items: [
          {
            label: "Graph",
            content: DependencyGraph({
              source: taskInstanceGraph(input),
              idField: "graphId",
              dependsOnField: "upstreamGraphIds",
              labelField: "name",
              detailField: "operator",
              stateField: "state",
              rowLink: {
                path: `/dags/${encodeURIComponent(params.dagId)}/runs/${encodeURIComponent(params.dagRunId)}/tasks/:taskId/:mapIndex/:tryNumber`,
                params: {
                  taskId: "taskId",
                  mapIndex: "mapIndex",
                  tryNumber: "tryNumber",
                },
              },
            }),
          },
          {
            label: "Details",
            content: KeyValue({
              title: "Run details",
              source: dagRunDetails(input),
            }),
          },
          {
            label: "Tasks",
            content: Table({
              source: taskInstances(input),
              columns: [
                { id: "name", label: "Task" },
                { id: "state", label: "State" },
                { id: "tryNumber", label: "Try" },
                { id: "duration", label: "Duration (s)" },
                { id: "operator", label: "Operator" },
              ],
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
                  icon: "retry",
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
                  icon: "clear",
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
      PageHeader({
        title: params.taskId,
        description: "Inspect task metadata and logs for this attempt.",
      }),
      Tabs({
        items: [
          {
            label: "Details",
            content: KeyValue({
              title: "Task details",
              source: taskInstanceDetails(input),
            }),
          },
          {
            label: `Log (try ${params.tryNumber})`,
            content: Table({
              source: taskLog({
                ...input,
                tryNumber: Number(params.tryNumber),
              }),
              columns: [
                { id: "timestamp", label: "Timestamp" },
                { id: "event", label: "Event" },
              ],
            }),
          },
        ],
      }),
    ];
  },
});
