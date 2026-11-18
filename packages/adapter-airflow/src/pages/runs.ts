import {
  CodeBlock,
  Collection,
  definePage,
  KeyValue,
  List,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { clearTask, retryTask } from "../actions/tasks.js";
import { DependencyGraph } from "../components/dependency-graph.js";
import {
  dagRunDetails,
  dagRunLogs,
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
            label: "Logs",
            content: Collection({
              source: dagRunLogs(input),
              content: CodeBlock({
                label: { field: "label" },
                value: { field: "content" },
                language: "text",
              }),
            }),
          },
          {
            label: "Tasks",
            content: List({
              source: taskInstances(input),
              noun: "task",
              searchable: true,
              pageSize: 25,
              filters: [
                { field: "stateLabel", label: "State" },
                { field: "operator", label: "Operator" },
              ],
              item: {
                icon: "network",
                title: "name",
                badge: "operator",
                description: "attempt",
                status: {
                  label: "stateLabel",
                  tone: "stateTone",
                  detail: "durationLabel",
                },
              },
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
                  icon: "reload",
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
                  icon: "reload",
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
  render: ({ params, query }) => {
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
        defaultIndex: query.get("tab") === "log" ? 1 : 0,
        items: [
          {
            label: "Details",
            link: `/dags/${encodeURIComponent(params.dagId)}/runs/${encodeURIComponent(params.dagRunId)}/tasks/${encodeURIComponent(params.taskId)}/${params.mapIndex}/${params.tryNumber}`,
            content: KeyValue({
              title: "Task details",
              source: taskInstanceDetails(input),
            }),
          },
          {
            label: `Log (try ${params.tryNumber})`,
            link: `/dags/${encodeURIComponent(params.dagId)}/runs/${encodeURIComponent(params.dagRunId)}/tasks/${encodeURIComponent(params.taskId)}/${params.mapIndex}/${params.tryNumber}?tab=log`,
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
