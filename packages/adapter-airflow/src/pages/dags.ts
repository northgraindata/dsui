import {
  Button,
  DependencyGraph,
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { pauseDag, triggerDag, unpauseDag } from "../actions/dags.js";
import { dagDetails, dags, dagTasks } from "../resources/dags.js";
import { dagRuns } from "../resources/runs.js";

export const dagListPage = definePage({
  path: "/dags",
  render: () => [
    PageHeader({
      title: "DAGs",
      description: "Monitor schedules and start or pause workflows.",
    }),
    Table({
      source: dags(),
      columns: [
        { id: "name", label: "DAG" },
        { id: "schedule", label: "Schedule" },
        { id: "owners", label: "Owners" },
        { id: "isPaused", label: "Paused" },
        { id: "lastParsedTime", label: "Last parsed" },
      ],
      rowLink: { path: "/dags/:dagId", params: { dagId: "dagId" } },
      rowActions: [
        {
          label: "Trigger",
          variant: "primary",
          action: triggerDag,
          input: { dagId: "dagId" },
        },
        {
          label: "Pause",
          action: pauseDag,
          input: { dagId: "dagId" },
          when: { field: "isPaused", equals: false },
        },
        {
          label: "Unpause",
          action: unpauseDag,
          input: { dagId: "dagId" },
          when: { field: "isPaused", equals: true },
        },
      ],
    }),
  ],
});

export const dagDetailPage = definePage({
  path: "/dags/:dagId",
  render: ({ params }) => [
    PageHeader({
      title: params.dagId,
      description: "Inspect configuration, dependencies, and recent runs.",
    }),
    Button({
      label: "Trigger",
      variant: "primary",
      action: triggerDag({ dagId: params.dagId, conf: {} }),
    }),
    Button({
      label: "Pause",
      variant: "secondary",
      action: pauseDag({ dagId: params.dagId }),
    }),
    Button({
      label: "Unpause",
      variant: "secondary",
      action: unpauseDag({ dagId: params.dagId }),
    }),
    Tabs({
      items: [
        {
          label: "Details",
          content: KeyValue({
            title: "DAG details",
            source: dagDetails({ dagId: params.dagId }),
          }),
        },
        {
          label: "Graph",
          content: DependencyGraph({
            source: dagTasks({ dagId: params.dagId }),
            idField: "taskId",
            dependsOnField: "upstreamTaskIds",
            labelField: "name",
            detailField: "operator",
          }),
        },
        {
          label: "Runs",
          content: Table({
            source: dagRuns({ dagId: params.dagId }),
            columns: [
              { id: "dagRunId", label: "Run" },
              { id: "state", label: "State" },
              { id: "runType", label: "Type" },
              { id: "logicalDate", label: "Logical date" },
              { id: "startDate", label: "Started" },
              { id: "endDate", label: "Ended" },
            ],
            rowLink: {
              path: `/dags/${encodeURIComponent(params.dagId)}/runs/:dagRunId`,
              params: { dagRunId: "dagRunId" },
            },
          }),
        },
      ],
    }),
  ],
});
