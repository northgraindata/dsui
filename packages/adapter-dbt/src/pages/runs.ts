import {
  Badge,
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
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
      Table({
        ...(archived.length ? { data: archived } : { source: runs() }),
        columns: [
          { id: "id", label: "Run" },
          { id: "job_id", label: "Job" },
          {
            id: "status",
            label: "Status",
            renderCell: Badge({ label: { field: "status" }, dot: true }),
          },
          { id: "cause", label: "Cause" },
          { id: "started_at", label: "Started" },
        ],
        rowLink: { path: "/runs/:runId", params: { runId: "id" } },
        rowActions: [
          {
            action: cancelRun,
            label: "Cancel",
            icon: "stop",
            input: { runId: "id" },
          },
        ],
      }),
    ];
  },
});
