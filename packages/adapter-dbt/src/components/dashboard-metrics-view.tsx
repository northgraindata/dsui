import {
  Card,
  Columns,
  componentProps,
  Grid,
  Section,
  Value,
  type ComponentProps,
  type ResourceReference,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { useEffect, useState } from "react";
import { DbtRunHistoryChart } from "./dashboard-metrics";

type Props = { source: ResourceReference };
const historySchema = z.array(
  z.object({
    date: z.string(),
    label: z.string(),
    success: z.number(),
    warning: z.number(),
    error: z.number(),
  }),
);

export default function DashboardMetrics(props: ComponentProps) {
  const { source } = componentProps<Props>(props.node) ?? {};
  const [data, setData] = useState<Record<string, unknown>>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!source) return;
    let active = true;
    void props.client
      .executeResource(source)
      .then((result) => {
        if (
          active &&
          result &&
          typeof result === "object" &&
          !Array.isArray(result)
        ) {
          setData(result as Record<string, unknown>);
          setError(false);
        } else if (active) setError(true);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [props.client, source]);
  if (!source) return null;
  if (error)
    return (
      <p className="text-unavailable" role="alert">
        Could not load dbt overview metrics.
      </p>
    );
  if (!data)
    return (
      <p className="text-secondary" aria-busy="true">
        Loading dbt overview…
      </p>
    );
  const cards = [
    metric("table", "Models", "models"),
    metric("check", "Tests", "tests"),
    metric("database", "Sources", "sources"),
  ];
  const cloud = data?.method === "cloud";
  if (cloud) {
    cards.push(
      metric("folder", "Projects", "projects"),
      metric("play", "Jobs", "jobs"),
    );
  }
  const history = historySchema.safeParse(data.history);
  const content = Columns({
    columns: [
      {
        weight: 2,
        content: Section({
          title: "Latest run",
          description: "Most recent dbt execution",
          link: { label: "View runs", path: "/runs" },
          content: Card({
            variant: "panel",
            description: { field: "latestDuration" },
            badge: { field: "latestStatus" },
            badgeTone: { field: "latestTone" },
            content: Value({
              field: "latestSummary",
              fallback: "No run details",
            }),
          }),
        }),
      },
      {
        content: Section({
          title: "Run history",
          description: "Daily runs over the last 7 days",
          content: DbtRunHistoryChart({
            history: history.success ? history.data : [],
          }),
        }),
      },
    ],
  });
  return (
    <>
      {props.renderNode(props.client, Grid({ content: cards }), data)}
      {props.renderNode(props.client, content, data)}
    </>
  );
}

function metric(icon: string, title: string, field: string) {
  return Card({
    variant: "metric",
    icon,
    title,
    content: Value({ field, format: "number", fallback: "Unavailable" }),
  });
}
