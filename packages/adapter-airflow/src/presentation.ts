import type { AdapterPresentation } from "@northgraindata/dsui-adapter-sdk";

export const presentation = {
  category: "Orchestration",
  overview:
    "Browse DAGs, runs, task instances and assets. Trigger runs and manage tasks through the Airflow API.",
  features: [
    {
      title: "DAG explorer",
      description: "Browse DAGs and inspect their runs and task instances.",
    },
    {
      title: "Run operations",
      description:
        "Trigger runs and operate DAGs and tasks through the connected API.",
    },
    {
      title: "Assets & administration",
      description:
        "Explore assets and inspect Airflow administration resources.",
    },
  ],
  compatibility: [
    "Airflow 3 with JWT authentication.",
    "Airflow 2.10 with Basic authentication for the stable REST API.",
  ],
  limitations: [
    "Available operations depend on your Airflow API permissions and version.",
  ],
  links: [
    {
      kind: "documentation",
      label: "DSUI adapter guide",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-airflow#readme",
    },
    {
      kind: "documentation",
      label: "Product documentation",
      href: "https://airflow.apache.org/docs/",
    },
    {
      kind: "website",
      label: "Official website",
      href: "https://airflow.apache.org/",
    },
    {
      kind: "source",
      label: "Adapter source",
      href: "https://github.com/northgraindata/dsui/tree/main/packages/adapter-airflow/src",
    },
  ],
} satisfies AdapterPresentation;
