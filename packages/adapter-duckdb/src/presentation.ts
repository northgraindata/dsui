import type { AdapterPresentation } from "@northgraindata/dsui-adapter-sdk";

export const presentation = {
  category: "Databases",
  overview:
    "Connect to an in-memory database, a local database file or a remote data source.",
  features: [
    {
      title: "SQL workspace",
      description: "Run SQL, inspect results and revisit query history.",
    },
    {
      title: "Database explorer",
      description: "Browse databases, schemas, tables, views and columns.",
    },
    {
      title: "Database tools",
      description: "Inspect extensions, storage, settings and secrets.",
    },
  ],
  limitations: [
    "Local files must be accessible from the machine running the connection.",
  ],
  links: [
    {
      kind: "documentation",
      label: "DSUI adapter guide",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-duckdb#readme",
    },
    {
      kind: "documentation",
      label: "Product documentation",
      href: "https://duckdb.org/docs/stable/",
    },
    {
      kind: "website",
      label: "Official website",
      href: "https://duckdb.org/",
    },
    {
      kind: "source",
      label: "Adapter source",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-duckdb/src",
    },
  ],
} satisfies AdapterPresentation;
