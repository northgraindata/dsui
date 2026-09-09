import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { queryHistory } from "../resources/history.js";

export const activityPage = definePage({
  path: "/activity",
  render: () => [
    PageHeader({
      title: "Query History",
      description: "Queries executed through DSUI for this DuckDB instance.",
    }),
    Table({
      source: queryHistory({ search: "", status: null }),
      columns: [
        { id: "startedAt", label: "Started" },
        { id: "status", label: "Status" },
        { id: "elapsedMs", label: "Duration (ms)" },
        { id: "rows", label: "Rows" },
        { id: "sql", label: "SQL" },
      ],
    }),
  ],
});
