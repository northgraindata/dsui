import {
  Badge,
  Button,
  Card,
  Collection,
  Columns,
  definePage,
  Grid,
  KeyValue,
  PageHeader,
  Section,
  Stack,
  Table,
  Tabs,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import {
  launchJob,
  materializeAsset,
  startSchedule,
  startSensor,
  stopSchedule,
  stopSensor,
  terminateRun,
} from "./actions.js";
import { AssetGraph } from "./components/asset-graph.js";
import {
  assetChecks,
  assetDetails,
  assetDownstream,
  assetGraph,
  assetHistory,
  assetJobs,
  assetLineage,
  assets,
  assetUpstream,
  jobAssets,
  jobDetails,
  jobGraph,
  jobRuns,
  jobs,
  overview,
  runAssets,
  runDetails,
  runGraph,
  runLogs,
  runs,
  schedules,
  sensors,
} from "./resources.js";

const assetRoute = "/assets/:id";
const assetLink = { path: assetRoute, params: { id: "id" } };
const runLink = { path: "/runs/:runId", params: { runId: "runId" } };
const jobRoute = "/jobs/:repositoryLocationName/:repositoryName/:name";
const jobParams = {
  repositoryLocationName: "repositoryLocationName",
  repositoryName: "repositoryName",
  name: "name",
};
const materializeNode = {
  label: "Materialize",
  action: materializeAsset,
  input: { id: "id" },
  when: { field: "materializable", equals: true },
};

function statusBadge(label: string, tone: string) {
  return Badge({ label: { field: label }, tone: { field: tone }, dot: true });
}

function assetsTable(
  source:
    | ReturnType<typeof assets>
    | ReturnType<typeof assetUpstream>
    | ReturnType<typeof assetDownstream>
    | ReturnType<typeof jobAssets>
    | ReturnType<typeof runAssets>,
) {
  return Table({
    source,
    searchable: true,
    pageSize: 25,
    columns: [
      { id: "name", label: "Asset" },
      { id: "group", label: "Group" },
      { id: "kinds", label: "Kinds" },
      {
        id: "status",
        label: "Status",
        renderCell: statusBadge("status", "statusTone"),
      },
      { id: "materializedAt", label: "Last materialized" },
      { id: "checks", label: "Checks" },
      { id: "ownerNames", label: "Owners" },
    ],
    rowLink: assetLink,
    rowActions: [
      {
        label: "Materialize",
        icon: "play",
        action: materializeAsset,
        input: { id: "id" },
        when: { field: "materializable", equals: true },
        successLink: runLink,
      },
    ],
  });
}

function jobsTable(
  source: ReturnType<typeof jobs> | ReturnType<typeof assetJobs>,
) {
  return Table({
    source,
    searchable: true,
    pageSize: 25,
    columns: [
      { id: "name", label: "Job" },
      { id: "type", label: "Type" },
      { id: "repositoryName", label: "Repository" },
      { id: "description", label: "Description" },
      {
        id: "latestStatus",
        label: "Latest run",
        renderCell: statusBadge("latestStatus", "latestStatusTone"),
      },
      { id: "lastRun", label: "Started" },
    ],
    rowLink: { path: jobRoute, params: jobParams },
    rowActions: [
      {
        label: "Launch run",
        icon: "play",
        variant: "primary",
        action: launchJob,
        input: jobParams,
        successLink: runLink,
      },
    ],
  });
}

function runsTable(
  source: ReturnType<typeof runs> | ReturnType<typeof jobRuns>,
) {
  return Table({
    source,
    pageSize: 25,
    columns: [
      { id: "jobName", label: "Job" },
      { id: "runId", label: "Run ID" },
      {
        id: "status",
        label: "Status",
        renderCell: statusBadge("status", "statusTone"),
      },
      { id: "startedAt", label: "Started" },
      { id: "duration", label: "Duration" },
    ],
    rowLink: runLink,
    rowActions: [
      {
        label: "Terminate",
        icon: "close",
        variant: "danger",
        action: terminateRun,
        input: { runId: "runId" },
        when: { field: "status", equals: "STARTED" },
        confirmation: {
          title: "Terminate this run?",
          description: "Dagster will stop the in-progress job run.",
          confirmLabel: "Terminate",
        },
      },
    ],
  });
}

function metric(icon: string, title: string, field: string) {
  return Card({
    variant: "metric",
    icon,
    title,
    content: Value({ source: overview(), field, format: "number" }),
  });
}

export const overviewPage = definePage({
  path: "/",
  render: () => [
    Grid({
      columns: 4,
      content: [
        metric("layers", "Assets", "totalAssets"),
        metric("warning", "Assets needing attention", "staleAssets"),
        metric("check", "Assets with failing checks", "failingChecks"),
        metric("clock", "Active schedules & sensors", "runningAutomations"),
        metric("grid", "Jobs", "totalJobs"),
        metric("history", "Recent runs", "totalRuns"),
        metric("check", "Successful runs", "successfulRuns"),
        metric("warning", "Failed runs", "failedRuns"),
      ],
    }),
    Columns({
      columns: [
        {
          weight: 3,
          content: Section({
            title: "Jobs",
            description: "Inspect definitions and launch work.",
            link: { label: "View all", path: "/jobs" },
            content: jobsTable(jobs()),
          }),
        },
        {
          content: Section({
            title: "Explore",
            content: Stack({
              gap: "sm",
              content: [
                Button({
                  variant: "list-item",
                  icon: "network",
                  label: "Asset lineage",
                  description: "See every asset by group and kind",
                  link: "/lineage",
                }),
                Button({
                  variant: "list-item",
                  icon: "layers",
                  label: "Browse assets",
                  description: "Status, checks, and materializations",
                  link: "/assets",
                }),
                Button({
                  variant: "list-item",
                  icon: "grid",
                  label: "Browse jobs",
                  description: "See jobs across code locations",
                  link: "/jobs",
                }),
                Button({
                  variant: "list-item",
                  icon: "clock",
                  label: "Automation",
                  description: "Start and stop schedules and sensors",
                  link: "/automation",
                }),
                Button({
                  variant: "list-item",
                  icon: "activity",
                  label: "View runs",
                  description: "Inspect execution history and logs",
                  link: "/runs",
                }),
              ],
            }),
          }),
        },
      ],
    }),
  ],
});

export const lineagePage = definePage({
  path: "/lineage",
  render: () => [
    PageHeader({
      title: "Lineage",
      description:
        "Every asset by dependency, framed by group and tagged with its kinds. Hover to trace upstream and downstream.",
    }),
    AssetGraph({
      source: assetGraph(),
      rowLink: assetLink,
      nodeAction: materializeNode,
      emptyMessage: "This Dagster instance defines no assets.",
    }),
  ],
});

export const assetsPage = definePage({
  path: "/assets",
  render: () => [
    PageHeader({
      title: "Assets",
      description: "Explore Dagster assets, their status, and checks.",
    }),
    assetsTable(assets()),
  ],
});

export const assetPage = definePage({
  path: assetRoute,
  render: ({ params }) => {
    const input = { id: params.id };
    return [
      Collection({
        source: assetDetails(input),
        content: [
          PageHeader({
            title: { field: "name" },
            description: { field: "description" },
            variant: "detail",
            icon: "layers",
            actions: [
              Button({
                label: "Materialize",
                icon: "play",
                variant: "primary",
                action: materializeAsset(input),
                successLink: runLink,
              }),
            ],
          }),
          Tabs({
            items: [
              {
                label: "Lineage",
                content: AssetGraph({
                  source: assetLineage(input),
                  rowLink: assetLink,
                  nodeAction: materializeNode,
                }),
              },
              {
                label: "Dependencies",
                content: Stack({
                  gap: "md",
                  content: [
                    Section({
                      title: "Upstream assets",
                      description: "Assets this asset depends on.",
                      content: assetsTable(assetUpstream(input)),
                    }),
                    Section({
                      title: "Downstream assets",
                      description: "Assets that depend on this asset.",
                      content: assetsTable(assetDownstream(input)),
                    }),
                  ],
                }),
              },
              {
                label: "Checks",
                content: Table({
                  source: assetChecks(input),
                  columns: [
                    { id: "name", label: "Check" },
                    {
                      id: "result",
                      label: "Latest result",
                      renderCell: statusBadge("result", "resultTone"),
                    },
                    { id: "description", label: "Description" },
                    { id: "blocking", label: "Blocking" },
                    { id: "executedAt", label: "Executed" },
                  ],
                  rowLink: runLink,
                }),
              },
              {
                label: "Materializations",
                content: Table({
                  source: assetHistory(input),
                  pageSize: 25,
                  columns: [
                    { id: "materializedAt", label: "Materialized" },
                    { id: "ago", label: "Age" },
                    { id: "runId", label: "Run ID" },
                    { id: "stepKey", label: "Step" },
                  ],
                  rowLink: runLink,
                }),
              },
              { label: "Jobs", content: jobsTable(assetJobs(input)) },
              {
                label: "Details",
                content: KeyValue({
                  title: "Asset details",
                  source: assetDetails(input),
                }),
              },
            ],
          }),
        ],
      }),
    ];
  },
});

export const jobsPage = definePage({
  path: "/jobs",
  render: () => [
    PageHeader({
      title: "Jobs",
      description: "Launch and inspect Dagster jobs.",
    }),
    jobsTable(jobs()),
  ],
});

export const jobPage = definePage({
  path: jobRoute,
  render: ({ params }) => {
    const input = {
      repositoryLocationName: params.repositoryLocationName,
      repositoryName: params.repositoryName,
      name: params.name,
    };
    return [
      Collection({
        source: jobDetails(input),
        content: [
          PageHeader({
            title: { field: "name" },
            description: { field: "description" },
            variant: "detail",
            icon: "grid",
            actions: [
              Button({
                label: "Launch run",
                icon: "play",
                variant: "primary",
                action: launchJob(input),
                successLink: runLink,
              }),
            ],
          }),
          Tabs({
            items: [
              {
                label: "Lineage",
                content: AssetGraph({
                  source: jobGraph(input),
                  rowLink: assetLink,
                  nodeAction: materializeNode,
                  noun: "node",
                  emptyMessage: "This job has no ops or assets.",
                }),
              },
              { label: "Assets", content: assetsTable(jobAssets(input)) },
              { label: "Runs", content: runsTable(jobRuns(input)) },
              {
                label: "Details",
                content: KeyValue({
                  title: "Job details",
                  source: jobDetails(input),
                }),
              },
            ],
          }),
        ],
      }),
    ];
  },
});

const instigatorParams = {
  repositoryLocationName: "repositoryLocationName",
  repositoryName: "repositoryName",
  name: "name",
  stateId: "stateId",
};

export const automationPage = definePage({
  path: "/automation",
  render: () => [
    PageHeader({
      title: "Automation",
      description: "Schedules and sensors that launch Dagster runs.",
    }),
    Stack({
      gap: "md",
      content: [
        Section({
          title: "Schedules",
          description: "Launch jobs on a cron schedule.",
          content: Table({
            source: schedules(),
            searchable: true,
            columns: [
              { id: "name", label: "Schedule" },
              {
                id: "statusLabel",
                label: "Status",
                renderCell: statusBadge("statusLabel", "statusTone"),
              },
              { id: "jobName", label: "Job" },
              { id: "cron", label: "Cron" },
              { id: "nextTickAt", label: "Next tick" },
              { id: "lastTickAt", label: "Last tick" },
            ],
            rowActions: [
              {
                label: "Start",
                icon: "play",
                variant: "primary",
                action: startSchedule,
                input: instigatorParams,
                when: { field: "running", equals: false },
              },
              {
                label: "Stop",
                icon: "pause",
                action: stopSchedule,
                input: instigatorParams,
                when: { field: "running", equals: true },
              },
            ],
          }),
        }),
        Section({
          title: "Sensors",
          description: "Launch jobs when something changes.",
          content: Table({
            source: sensors(),
            searchable: true,
            columns: [
              { id: "name", label: "Sensor" },
              {
                id: "statusLabel",
                label: "Status",
                renderCell: statusBadge("statusLabel", "statusTone"),
              },
              { id: "type", label: "Type" },
              { id: "jobs", label: "Targets" },
              { id: "interval", label: "Interval" },
              { id: "lastTickAt", label: "Last tick" },
              { id: "lastResult", label: "Last result" },
            ],
            rowActions: [
              {
                label: "Start",
                icon: "play",
                variant: "primary",
                action: startSensor,
                input: instigatorParams,
                when: { field: "running", equals: false },
              },
              {
                label: "Stop",
                icon: "pause",
                action: stopSensor,
                input: instigatorParams,
                when: { field: "running", equals: true },
              },
            ],
          }),
        }),
      ],
    }),
  ],
});

export const runsPage = definePage({
  path: "/runs",
  render: () => [
    PageHeader({
      title: "Runs",
      description: "Follow job execution across your Dagster instance.",
    }),
    runsTable(runs()),
  ],
});

export const runPage = definePage({
  path: "/runs/:runId",
  render: ({ params }) => {
    const input = { runId: params.runId };
    return [
      PageHeader({
        title: params.runId,
        description: "Review run status, steps, and execution events.",
      }),
      Tabs({
        items: [
          {
            label: "Graph",
            content: AssetGraph({
              source: runGraph(input),
              noun: "step",
              refreshMs: 3_000,
              emptyMessage: "Step details are not available for this run.",
            }),
          },
          {
            label: "Assets",
            content: assetsTable(runAssets(input)),
          },
          {
            label: "Events",
            content: Table({
              source: runLogs(input),
              pageSize: 50,
              columns: [
                { id: "timestamp", label: "Time" },
                { id: "stepKey", label: "Step" },
                { id: "level", label: "Level" },
                { id: "message", label: "Message" },
              ],
            }),
          },
          {
            label: "Details",
            content: KeyValue({
              title: "Run details",
              source: runDetails(input),
            }),
          },
        ],
      }),
    ];
  },
});
