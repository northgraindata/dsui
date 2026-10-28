import {
  Card,
  Chart,
  Columns,
  definePage,
  Grid,
  PageHeader,
  Section,
  Table,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import {
  creditsByDay,
  creditsByWarehouse,
  slowQueries,
  storageByDatabase,
  usageSummary,
} from "./resources.js";

export const usagePage = definePage({
  path: "/usage",
  render: () => [
    PageHeader({
      title: "Cost & usage",
      description:
        "Credits, storage and slow queries from SNOWFLAKE.ACCOUNT_USAGE. Data can lag by up to three hours and needs IMPORTED PRIVILEGES on the SNOWFLAKE database.",
    }),
    Grid({
      content: [
        Card({
          variant: "metric",
          icon: "activity",
          title: "Credits (7 days)",
          content: Value({ source: usageSummary(), field: "credits7d" }),
        }),
        Card({
          variant: "metric",
          icon: "activity",
          title: "Credits (30 days)",
          content: Value({ source: usageSummary(), field: "credits30d" }),
        }),
      ],
    }),
    Section({
      title: "Credits per day",
      description: "All warehouses, last 30 days.",
      content: Chart({
        source: creditsByDay(),
        kind: "area",
        label: "Credits used per day",
      }),
    }),
    Columns({
      columns: [
        {
          weight: 1,
          content: Section({
            title: "Credits by warehouse",
            description: "Last 30 days.",
            content: Table({
              source: creditsByWarehouse(),
              columns: [
                { id: "warehouse", label: "Warehouse" },
                { id: "credits", label: "Credits" },
                { id: "computeCredits", label: "Compute" },
                { id: "cloudServicesCredits", label: "Cloud services" },
              ],
              pageSize: 10,
            }),
          }),
        },
        {
          weight: 1,
          content: Section({
            title: "Storage by database",
            description: "Latest daily average.",
            content: Table({
              source: storageByDatabase(),
              columns: [
                { id: "database", label: "Database" },
                { id: "storageGb", label: "Storage (GB)" },
                { id: "failsafeGb", label: "Fail-safe (GB)" },
              ],
              pageSize: 10,
            }),
          }),
        },
      ],
    }),
    Section({
      title: "Slowest queries",
      description: "Longest-running queries in the last 7 days.",
      content: Table({
        source: slowQueries(),
        columns: [
          { id: "elapsedSeconds", label: "Elapsed (s)" },
          { id: "user", label: "User" },
          { id: "warehouse", label: "Warehouse" },
          { id: "gbScanned", label: "Scanned (GB)" },
          { id: "text", label: "Query" },
        ],
        searchable: true,
        pageSize: 25,
      }),
    }),
  ],
});
