import { definePage, List, PageHeader } from "@northgraindata/dsui-adapter-sdk";
import { sources, tests } from "../resources/catalog.js";

export const sourcesPage = definePage({
  path: "/sources",
  render: () => [
    PageHeader({
      title: "Sources",
      description: "Sources and freshness from dbt artifacts.",
    }),
    List({
      source: sources(),
      noun: "source",
      searchable: true,
      filters: [
        { field: "sourceName", label: "Source" },
        { field: "status", label: "Freshness" },
      ],
      item: {
        icon: "database",
        title: "name",
        badge: "sourceName",
        description: "location",
        meta: ["error"],
        status: { label: "status", detail: "maxLoadedAt" },
      },
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
    List({
      source: tests(),
      noun: "test",
      searchable: true,
      filters: [{ field: "status", label: "Status" }],
      item: {
        icon: "check",
        title: "name",
        description: "attachedTo",
        meta: ["message"],
        status: { label: "status" },
      },
    }),
  ],
});
