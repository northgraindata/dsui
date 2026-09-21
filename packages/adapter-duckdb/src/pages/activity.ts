import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { ageLabel, formatDuration } from "../resources/catalog.js";
import { queryHistoryStore } from "../stores/index.js";

export const activityPage = definePage({
  path: "/activity",
  stores: [queryHistoryStore],
  render: ({ stores }) => {
    const entries = stores.use(queryHistoryStore).entries;
    const rows = entries.map((entry) => ({
      startedAt: ageLabel(entry.startedAt),
      status: entry.status,
      elapsedMs: formatDuration(entry.elapsedMs),
      rows: entry.rows,
      sql: entry.sql,
    }));
    return [
      PageHeader({
        title: "Query History",
        description: "Queries executed through DSUI for this DuckDB instance.",
      }),
      Table({
        data: rows,
        columns: [
          { id: "startedAt", label: "Started" },
          { id: "status", label: "Status" },
          { id: "elapsedMs", label: "Duration" },
          { id: "rows", label: "Rows" },
          { id: "sql", label: "SQL" },
        ],
      }),
    ];
  },
});
