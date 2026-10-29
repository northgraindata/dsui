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
import { launchJob, terminateRun } from "./actions.js";
import {
  assetDetails,
  assetDownstream,
  assets,
  assetUpstream,
  jobDetails,
  jobRuns,
  jobSteps,
  jobs,
  overview,
  runDetails,
  runLogs,
  runs,
} from "./resources.js";

const assetRoute = "/assets/:id";

function assetsTable(
  source:
    | ReturnType<typeof assets>
    | ReturnType<typeof assetUpstream>
    | ReturnType<typeof assetDownstream>,
) {
  return Table({
    source,
    searchable: true,
    pageSize: 25,
    columns: [
      { id: "name", label: "Asset" },
      { id: "group", label: "Group" },
      { id: "repositoryName", label: "Repository" },
      { id: "ownerNames", label: "Owners" },
      { id: "materializedAt", label: "Last materialized" },
      { id: "checks", label: "Checks" },
    ],
    rowLink: { path: assetRoute, params: { id: "id" } },
  });
}

export const assetsPage = definePage({
  path: "/assets",
  render: () => [
    PageHeader({
      title: "Assets",
      description: "Explore Dagster assets and their dependencies.",
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
            icon: "grid",
          }),
          Tabs({
            items: [
              {
                label: "Lineage",
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

const jobRoute = "/jobs/:repositoryLocationName/:repositoryName/:name";
const jobParams = {
  repositoryLocationName: "repositoryLocationName",
  repositoryName: "repositoryName",
  name: "name",
};

function jobsTable() {
  return Table({
    source: jobs(),
    searchable: true,
    pageSize: 25,
    columns: [
      { id: "name", label: "Job" },
      { id: "repositoryName", label: "Repository" },
      { id: "description", label: "Description" },
      {
        id: "latestStatus",
        label: "Latest run",
        renderCell: Badge({
          label: { field: "latestStatus" },
          tone: { field: "latestStatusTone" },
          dot: true,
        }),
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
        successLink: { path: "/runs/:runId", params: { runId: "runId" } },
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
        renderCell: Badge({
          label: { field: "status" },
          tone: { field: "statusTone" },
          dot: true,
        }),
      },
      { id: "startedAt", label: "Started" },
      { id: "endedAt", label: "Ended" },
    ],
    rowLink: { path: "/runs/:runId", params: { runId: "runId" } },
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

export const overviewPage = definePage({
  path: "/",
  render: () => [
    Grid({
      columns: 4,
      content: [
        Card({
          variant: "metric",
          icon: "grid",
          title: "Jobs",
          content: Value({
            source: overview(),
            field: "totalJobs",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "history",
          title: "Recent runs",
          content: Value({
            source: overview(),
            field: "totalRuns",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "check",
          title: "Successful",
          content: Value({
            source: overview(),
            field: "successfulRuns",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "warning",
          title: "Failed",
          content: Value({
            source: overview(),
            field: "failedRuns",
            format: "number",
          }),
        }),
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
            content: jobsTable(),
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
                  icon: "grid",
                  label: "Browse assets",
                  description: "Explore asset lineage and materializations",
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

export const jobsPage = definePage({
  path: "/jobs",
  render: () => [
    PageHeader({
      title: "Jobs",
      description: "Launch and inspect Dagster jobs.",
    }),
    jobsTable(),
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
                successLink: {
                  path: "/runs/:runId",
                  params: { runId: "runId" },
                },
              }),
            ],
          }),
          Tabs({
            items: [
              {
                label: "Graph",
                content: Table({
                  source: jobSteps(input),
                  columns: [
                    { id: "name", label: "Op" },
                    { id: "upstream", label: "Depends on" },
                    { id: "kind", label: "Kind" },
                  ],
                }),
              },
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
        description: "Review run status and execution events.",
      }),
      Tabs({
        items: [
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
