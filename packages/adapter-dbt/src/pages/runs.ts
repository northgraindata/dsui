import { definePage, List, PageHeader } from "@northgraindata/dsui-adapter-sdk";
import { cancelRun } from "../actions/runs.js";
import { runs } from "../resources/runs.js";
import { dbtRunStore } from "../stores/runs.js";

export const runsPage = definePage({
  path: "/runs",
  stores: [dbtRunStore],
  render: ({ stores }) => {
    const archived = stores.use(dbtRunStore).runs.map((run) => ({
      id: run.id,
      job_id: run.jobId,
      status: run.status,
      cause: run.cause,
      started_at: run.startedAt,
    }));
    return [
      PageHeader({ title: "Runs", description: "Recent dbt executions." }),
      List({
        ...(archived.length ? { data: archived } : { source: runs() }),
        noun: "run",
        searchable: true,
        pageSize: 25,
        filters: [{ field: "status", label: "Status" }],
        item: {
          icon: "history",
          title: "job_id",
          description: "cause",
          meta: ["id"],
          status: { label: "status", detail: "started_at" },
        },
        emptyMessage: "No dbt runs yet.",
        rowLink: { path: "/runs/:runId", params: { runId: "id" } },
        rowActions: [
          {
            action: cancelRun,
            label: "Cancel",
            icon: "close",
            variant: "danger",
            input: { runId: "id" },
          },
        ],
      }),
    ];
  },
});
