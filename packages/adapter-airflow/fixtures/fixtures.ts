import { defineFixtures } from "../../ui-fixtures/src";
import { buildDagOverview } from "../src/resources/runs";

export default defineFixtures({
  params: {
    dagId: "daily_revenue",
    dagRunId: "scheduled__2026-01-15T00:00:00+00:00",
    taskId: "load_orders",
    mapIndex: "-1",
    tryNumber: "1",
    assetId: "1",
  },
  resources: {
    // The pause control's label, action and dialog must agree with each other,
    // which sampling each from its type cannot promise.
    "dag-overview": ({ rows, longText }) =>
      Array.from({ length: Math.min(rows, 1) }, () =>
        buildDagOverview(
          {
            dagId: "daily_revenue",
            name: longText
              ? "daily_revenue_with_an_unusually_long_identifier_that_never_offers_a_natural_wrapping_point"
              : "daily_revenue",
            description: "Rebuilds the daily revenue model.",
            isPaused: false,
            isStale: false,
            fileLocation: "/opt/airflow/dags/daily_revenue.py",
            schedule: "@daily",
            owners: "analytics",
            tags: "finance",
            lastParsedTime: "2026-01-15T10:15:00Z",
            nextRun: "2026-01-16T00:00:00Z",
          },
          [],
        ),
      ),
  },
});
