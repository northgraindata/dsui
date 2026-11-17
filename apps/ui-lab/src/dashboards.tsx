import {
  PageHeader,
  QueryEditor,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import * as React from "react";
import { HealthPage } from "../../../packages/plugin-health/src/health-page";
import { initializeReact } from "../../../packages/plugin-health/src/react";
import { monitoringOverview } from "../../../packages/plugin-monitoring/src/pages/overview-view";
import type { CatalogEntry } from "./catalog-types";
import {
  columns,
  createClient,
  type Scenario,
  scenarios,
  source,
} from "./fixtures";
import { NodePreview } from "./preview";

initializeReact(React);
function HealthPreview({ scenario }: { scenario: Scenario }) {
  const client = React.useMemo(() => createClient(scenario), [scenario]);
  return (
    <>
      <h2 className="lab-dashboard-title">Service health</h2>
      <HealthPage
        client={client}
        node={{ kind: "custom", props: {} }}
        renderNode={() => null}
      />
    </>
  );
}
function MonitoringPreview({ scenario }: { scenario: Scenario }) {
  const nodes = React.useMemo(
    () =>
      monitoringOverview({
        cpu: { cores: 8, loadAverage: [2.34, 1.82, 1.21] },
        memoryPercent: 58,
        processMemory: "256 MB",
        disks:
          scenario === "empty"
            ? []
            : [
                {
                  mount: "/data",
                  totalBytes: 1000000,
                  freeBytes: 280000,
                  usedPercent: 72,
                },
              ],
        windows: [
          { label: "1h", secs: 3600 },
          { label: "24h", secs: 86400 },
        ],
      }),
    [scenario],
  );
  return (
    <>
      <h2 className="lab-dashboard-title">Host monitoring</h2>
      <NodePreview scenario={scenario} nodes={nodes} />
    </>
  );
}
function DatabasePreview({ scenario }: { scenario: Scenario }) {
  const nodes = [
    PageHeader({
      title: "Analytics warehouse",
      description: "PostgreSQL · production · eu-central",
      icon: "database",
      badge: { label: "Connected", tone: "healthy" },
    }),
    Table({ source: source("tables"), columns, searchable: true, pageSize: 8 }),
    QueryEditor({
      language: "sql",
      value: "select * from analytics.orders limit 100;",
      action: "query",
    }),
  ];
  return <NodePreview scenario={scenario} nodes={nodes} />;
}
export const dashboards: CatalogEntry[] = [
  {
    id: "dashboards/monitoring",
    title: "Monitoring",
    description:
      "The production Monitoring composition, using deterministic local resources.",
    source: "packages/plugin-monitoring/src/pages/overview-view.ts",
    render: MonitoringPreview,
  },
  {
    id: "dashboards/health",
    title: "Health",
    description: "The production Health plugin component, with a local client.",
    source: "packages/plugin-health/src/health-page.tsx",
    render: HealthPreview,
  },
  {
    id: "dashboards/database",
    title: "Database",
    description:
      "Reference adapter workspace using production SDK blocks. This is a composition example, not an imported PostgreSQL page.",
    source: "apps/ui-lab/src/dashboards.tsx",
    render: DatabasePreview,
  },
].map(({ render: Preview, ...entry }) => ({
  ...entry,
  group: "Dashboards",
  examples: scenarios.map((scenario) => ({
    id: scenario,
    title: scenario,
    scenario,
    render: () => <Preview scenario={scenario} />,
  })),
}));
