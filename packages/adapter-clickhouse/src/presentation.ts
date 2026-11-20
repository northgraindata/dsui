import type { AdapterPresentation } from "@northgraindata/dsui-adapter-sdk";

export const presentation = {
  category: "Databases",
  overview:
    "Connect through HTTP or HTTPS to browse tables, run SQL and inspect active queries.",
  features: [
    {
      title: "SQL workspace",
      description: "Query ClickHouse and inspect results in DSUI.",
    },
    {
      title: "Database explorer",
      description: "Browse databases, tables and their structure.",
    },
    {
      title: "Query monitoring",
      description: "Inspect active queries and database activity.",
    },
  ],
  compatibility: [
    "Connect to ClickHouse Cloud or a self-hosted HTTP(S) endpoint.",
  ],
  limitations: [
    "This adapter connects through HTTP(S), rather than the native TCP interface.",
  ],
  links: [
    {
      kind: "documentation",
      label: "DSUI adapter guide",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-clickhouse#readme",
    },
    {
      kind: "documentation",
      label: "Product documentation",
      href: "https://clickhouse.com/docs",
    },
    {
      kind: "website",
      label: "Official website",
      href: "https://clickhouse.com/",
    },
    {
      kind: "source",
      label: "Adapter source",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-clickhouse/src",
    },
  ],
} satisfies AdapterPresentation;
