import {
  definePage,
  EntityCatalog,
  EntityDetail,
} from "@northgraindata/dsui-adapter-sdk";
import {
  extensionCatalog,
  extensionProfileResource,
} from "../resources/extensions.js";

export const extensionsPage = definePage({
  path: "/extensions",
  render: () => [
    EntityCatalog({
      title: "DuckDB",
      subtitle: "Manage extensions",
      description: "Extend DuckDB with additional functionality.",
      icon: "https://duckdb.org/images/favicon/apple-touch-icon.png",
      source: extensionCatalog(),
      createLabel: "Install extension",
      searchPlaceholder: "Search extensions…",
      filters: [
        { label: "All extensions" },
        { label: "Installed", field: "installed", equals: true },
        { label: "Available", field: "available", equals: true },
        { label: "Official", field: "provenance", equals: "Official" },
        { label: "Community", field: "provenance", equals: "Community" },
      ],
    }),
  ],
});

export const extensionPage = definePage({
  path: "/extensions/:extension",
  render: ({ params }) => [
    EntityDetail({
      source: extensionProfileResource({ name: params.extension }),
    }),
  ],
});
