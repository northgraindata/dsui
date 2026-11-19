import type { AdapterPresentation } from "@northgraindata/dsui-adapter-sdk";

export const presentation = {
  category: "Transformation",
  overview:
    "Browse models, lineage, runs and artifacts from local projects or dbt Cloud.",
  features: [
    {
      title: "Models & lineage",
      description: "Browse models, sources and tests with project context.",
    },
    {
      title: "Run history & artifacts",
      description:
        "Inspect manifests, catalogs, run results and other artifacts.",
    },
    {
      title: "Run operations",
      description:
        "Execute local commands or trigger and cancel dbt Cloud runs.",
    },
  ],
  compatibility: [
    "Local dbt projects and dbt Cloud accounts use separate connection methods.",
  ],
  limitations: [
    "Local commands require the project and its dbt environment to be available to the connection.",
  ],
  links: [
    {
      kind: "documentation",
      label: "DSUI adapter guide",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-dbt#readme",
    },
    {
      kind: "documentation",
      label: "Product documentation",
      href: "https://docs.getdbt.com/",
    },
    {
      kind: "website",
      label: "Official website",
      href: "https://www.getdbt.com/",
    },
    {
      kind: "source",
      label: "Adapter source",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-dbt/src",
    },
  ],
} satisfies AdapterPresentation;
