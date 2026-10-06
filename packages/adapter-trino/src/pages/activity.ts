import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { queryActivity } from "../resources/index.js";

export const activityPage = definePage({
  path: "/activity",
  render: () => [
    PageHeader({
      title: "Query activity",
      description: "Live and recent queries from the Trino coordinator.",
    }),
    Table({
      source: queryActivity(),
      columns: [
        { id: "queryId", label: "Query ID" },
        { id: "state", label: "State" },
        { id: "user", label: "User" },
        { id: "source", label: "Source" },
        { id: "resourceGroup", label: "Resource group" },
        { id: "progress", label: "Progress", format: "progress" },
        { id: "elapsed", label: "Elapsed" },
        { id: "cpu", label: "CPU" },
        { id: "memory", label: "Memory" },
        { id: "query", label: "SQL" },
      ],
      searchable: true,
      filters: [
        {
          field: "state",
          label: "State",
          options: [
            "QUEUED",
            "WAITING_FOR_RESOURCES",
            "DISPATCHING",
            "PLANNING",
            "STARTING",
            "RUNNING",
            "BLOCKED",
            "FINISHING",
            "FINISHED",
            "FAILED",
          ].map((state) => ({ label: state, value: state })),
        },
      ],
      rowLink: { path: "/activity/:queryId", params: { queryId: "queryId" } },
      pageSize: 25,
    }),
  ],
});
