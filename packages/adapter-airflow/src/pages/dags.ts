import {
  Badge,
  Button,
  Card,
  CodeBlock,
  Collection,
  Columns,
  definePage,
  Grid,
  KeyValue,
  List,
  PageHeader,
  Section,
  Stack,
  Tabs,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import {
  pauseDag,
  terminateDagRun,
  triggerDag,
  unpauseDag,
} from "../actions/dags.js";
import { DependencyGraph } from "../components/dependency-graph.js";
import { dagDetails, dagSource, dags, dagTasks } from "../resources/dags.js";
import {
  dagOverview,
  dagRuns,
  latestDagTaskGraph,
  recentDagRuns,
  taskInstanceGraph,
} from "../resources/runs.js";

/** Trigger sits on each DAG row; pausing lives in its menu. */
export const dagActions = [
  {
    label: "Trigger",
    icon: "play",
    variant: "primary" as const,
    action: triggerDag,
    input: { dagId: "dagId" },
    successLink: {
      path: "/dags/:dagId?tab=graph&runId=:dagRunId",
      params: { dagId: "dagId", dagRunId: "dagRunId" },
    },
  },
  {
    label: "Pause",
    icon: "pause",
    action: pauseDag,
    input: { dagId: "dagId" },
    when: { field: "isPaused", equals: false },
  },
  {
    label: "Unpause",
    icon: "play",
    action: unpauseDag,
    input: { dagId: "dagId" },
    when: { field: "isPaused", equals: true },
  },
];

export const dagListPage = definePage({
  path: "/dags",
  render: () => [
    PageHeader({
      title: "DAGs",
      description: "Monitor schedules and start or pause workflows.",
    }),
    List({
      source: dags(),
      noun: "DAG",
      searchable: true,
      pageSize: 25,
      filters: [
        {
          field: "status",
          label: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
          ],
        },
        { field: "owners", label: "Owner" },
      ],
      item: {
        icon: "network",
        title: "name",
        badge: "schedule",
        description: "description",
        meta: ["owners"],
        status: {
          label: "statusLabel",
          tone: "statusTone",
          detail: "nextRunLabel",
        },
      },
      rowLink: { path: "/dags/:dagId", params: { dagId: "dagId" } },
      rowActions: dagActions,
    }),
  ],
});

function metricCards() {
  return Grid({
    content: [
      Card({
        variant: "metric",
        icon: "history",
        title: "Recent runs",
        content: Value({ field: "totalRuns", format: "number" }),
      }),
      Card({
        variant: "metric",
        icon: "check",
        title: "Successful",
        content: Value({ field: "successfulRuns", format: "number" }),
      }),
      Card({
        variant: "metric",
        icon: "close",
        title: "Failed",
        content: Value({ field: "failedRuns", format: "number" }),
      }),
      Card({
        variant: "metric",
        icon: "activity",
        title: "Running",
        content: Value({ field: "runningRuns", format: "number" }),
      }),
      Card({
        variant: "metric",
        icon: "clock",
        title: "Last run duration",
        content: Value({ field: "lastRunDuration" }),
      }),
    ],
  });
}

function dagGraph(dagId: string, dagRunId?: string) {
  return DependencyGraph({
    source: dagRunId
      ? taskInstanceGraph({ dagId, dagRunId })
      : latestDagTaskGraph({ dagId }),
    idField: "graphId",
    dependsOnField: "upstreamGraphIds",
    labelField: "name",
    detailField: "operator",
    stateField: "state",
  });
}

/** Query-string parsers treat `+` as a space, but Airflow uses it in run IDs. */
export function normalizeDagRunId(value: string | null): string | undefined {
  return value?.replaceAll(" ", "+") || undefined;
}

function runsList(dagId: string, recent: boolean) {
  return List({
    source: recent ? recentDagRuns({ dagId }) : dagRuns({ dagId }),
    noun: "run",
    searchable: !recent,
    pageSize: recent ? undefined : 25,
    filters: recent ? undefined : [{ field: "stateLabel", label: "State" }],
    item: {
      icon: "history",
      title: "displayRunId",
      badge: "runType",
      description: "summary",
      status: { label: "stateLabel", tone: "stateTone", detail: "duration" },
    },
    emptyMessage: "This DAG has not run yet.",
    rowLink: {
      path: `/dags/${encodeURIComponent(dagId)}/runs/:dagRunId`,
      params: { dagRunId: "dagRunId" },
    },
    rowActions: [
      {
        label: "Terminate run",
        icon: "close",
        variant: "danger",
        action: terminateDagRun,
        input: { dagId: "dagId", dagRunId: "dagRunId" },
        when: { field: "state", equals: "running" },
        confirmation: {
          title: "Terminate DAG run?",
          description:
            "This marks the running DAG run as failed. Running tasks may take a moment to stop.",
          confirmLabel: "Terminate",
        },
      },
    ],
  });
}

function detailHeader(dagId: string) {
  return PageHeader({
    title: { field: "name" },
    description: { field: "description" },
    icon: "grid",
    variant: "detail",
    tags: [
      Badge({
        label: { field: "status" },
        tone: { field: "statusTone" },
        dot: true,
      }),
      Badge({ label: { field: "schedule" }, tone: "muted" }),
      Badge({ label: { field: "owners" }, tone: "info" }),
    ],
    actions: [
      Button({
        label: "Ⅱ",
        variant: "secondary",
        action: pauseDag({ dagId }),
      }),
      Button({
        label: "↻",
        variant: "secondary",
        action: unpauseDag({ dagId }),
      }),
      Button({
        label: "▷",
        variant: "primary",
        action: triggerDag({ dagId, conf: {} }),
        successLink: {
          path: "/dags/:dagId?tab=graph&runId=:dagRunId",
          params: { dagId: "dagId", dagRunId: "dagRunId" },
        },
      }),
    ],
  });
}

function overviewContent(dagId: string) {
  return [
    metricCards(),
    Columns({
      columns: [
        {
          weight: 3,
          content: Stack({
            gap: "md",
            content: Section({
              title: "Recent runs",
              description: "The five latest workflow runs.",
              content: runsList(dagId, true),
            }),
          }),
        },
        {
          content: KeyValue({
            title: "DAG details",
            source: dagDetails({ dagId }),
          }),
        },
      ],
    }),
  ];
}

function detailTabs(
  dagId: string,
  selectedTab: "overview" | "graph" | "runs" | "tasks" | "code" | "details",
  graphRunId?: string,
) {
  const basePath = `/dags/${encodeURIComponent(dagId)}`;
  const graphPath = graphRunId
    ? `${basePath}?tab=graph&runId=${encodeURIComponent(graphRunId)}`
    : `${basePath}?tab=graph`;
  const tabs = [
    "overview",
    "graph",
    "runs",
    "tasks",
    "code",
    "details",
  ] as const;
  return Tabs({
    defaultIndex: tabs.indexOf(selectedTab),
    variant: "detail",
    items: [
      { label: "Overview", link: basePath, content: overviewContent(dagId) },
      { label: "Graph", link: graphPath, content: dagGraph(dagId, graphRunId) },
      {
        label: "Runs",
        link: `${basePath}?tab=runs`,
        content: runsList(dagId, false),
      },
      {
        label: "Tasks",
        link: `${basePath}?tab=tasks`,
        content: List({
          source: dagTasks({ dagId }),
          noun: "task",
          searchable: true,
          filters: [{ field: "operator", label: "Operator" }],
          item: {
            icon: "network",
            title: "name",
            badge: "operator",
            description: "ownerLabel",
            meta: ["mappedLabel"],
          },
        }),
      },
      {
        label: "Code",
        link: `${basePath}?tab=code`,
        content: Collection({
          source: dagSource({ dagId }),
          content: CodeBlock({
            label: "DAG source",
            value: { field: "content" },
            language: "python",
          }),
        }),
      },
      {
        label: "Details",
        link: `${basePath}?tab=details`,
        content: KeyValue({
          title: "DAG details",
          source: dagDetails({ dagId }),
        }),
      },
    ],
  });
}

export const dagDetailPage = definePage({
  path: "/dags/:dagId",
  render: ({ params, query }) => {
    const requestedTab = query.get("tab");
    const selectedTab =
      requestedTab === "graph" ||
      requestedTab === "runs" ||
      requestedTab === "tasks" ||
      requestedTab === "code" ||
      requestedTab === "details"
        ? requestedTab
        : "overview";
    const graphRunId =
      selectedTab === "graph"
        ? normalizeDagRunId(query.get("runId"))
        : undefined;
    return [
      Collection({
        source: dagOverview({ dagId: params.dagId }),
        content: [
          detailHeader(params.dagId),
          detailTabs(params.dagId, selectedTab, graphRunId),
        ],
      }),
    ];
  },
});
