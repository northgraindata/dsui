import type { AdapterPresentation } from "@northgraindata/dsui-adapter-sdk";

export const presentation = {
  category: "Databases",
  overview: "Browse PostgreSQL schemas, run SQL and inspect active queries.",
  features: [
    {
      title: "SQL workspace",
      description: "Run SQL and inspect results from your connected database.",
    },
    {
      title: "Schema explorer",
      description: "Inspect schemas, relations, columns and constraints.",
    },
    {
      title: "Query activity",
      description:
        "Inspect database activity and cancel queries when your account permits it.",
    },
  ],
  limitations: [
    "Available objects and actions depend on the PostgreSQL role used for the connection.",
  ],
  links: [
    {
      kind: "documentation",
      label: "DSUI adapter guide",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-postgresql#readme",
    },
    {
      kind: "documentation",
      label: "Product documentation",
      href: "https://www.postgresql.org/docs/",
    },
    {
      kind: "website",
      label: "Official website",
      href: "https://www.postgresql.org/",
    },
    {
      kind: "source",
      label: "Adapter source",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-postgresql/src",
    },
  ],
} satisfies AdapterPresentation;
