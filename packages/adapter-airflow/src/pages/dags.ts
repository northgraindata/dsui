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
    PageHeader({ title: "DAGs" }),
    Table({
      source: dags(),
      rowLink: { path: "/dags/:dagId", params: { dagId: "dagId" } },
      rowActions: [
        {
          label: "Trigger",
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
    PageHeader({ title: params.dagId }),
    Button({
      label: "Trigger",
      action: triggerDag({ dagId: params.dagId, conf: {} }),
    }),
    Tabs({
      items: [
        {
          label: "Details",
          content: KeyValue({
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
