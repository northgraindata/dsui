import {
  Badge,
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { sources, tests } from "../resources/catalog.js";

export const sourcesPage = definePage({
  path: "/sources",
  render: () => [
    PageHeader({
      title: "Sources",
      description: "Sources and freshness from dbt artifacts.",
    }),
    Table({
      source: sources(),
      columns: [
        { id: "sourceName", label: "Source" },
        { id: "name", label: "Table" },
        { id: "database", label: "Database" },
        { id: "schema", label: "Schema" },
        {
          id: "status",
          label: "Freshness",
          renderCell: Badge({ label: { field: "status" }, dot: true }),
        },
        { id: "maxLoadedAt", label: "Last loaded" },
      ],
      searchable: true,
    }),
  ],
});

export const testsPage = definePage({
  path: "/tests",
  render: () => [
    PageHeader({
      title: "Tests",
      description: "Test definitions and latest results.",
    }),
    Table({
      source: tests(),
      columns: [
        { id: "name", label: "Test" },
        { id: "attachedTo", label: "Attached to" },
        {
          id: "status",
          label: "Status",
          renderCell: Badge({ label: { field: "status" }, dot: true }),
        },
        { id: "message", label: "Message" },
      ],
      searchable: true,
    }),
  ],
});
