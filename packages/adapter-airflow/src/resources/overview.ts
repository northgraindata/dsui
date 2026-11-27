import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";
import { runStateTone, stateLabel } from "./runs.js";

function formatDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export const overview = defineResource({
  id: "overview",
  query: async (_, ctx: AirflowContext) => {
    const dags = await ctx.client.listDags();
    return {
      totalDags: dags.length,
      activeDags: dags.filter((dag) => !dag.isPaused).length,
      pausedDags: dags.filter((dag) => dag.isPaused).length,
      staleDags: dags.filter((dag) => dag.isStale).length,
    };
  },
});

/** The overview shows a few DAGs; each one costs a request for its runs. */
const OVERVIEW_DAGS = 10;

export const overviewDags = defineResource({
  id: "overview-dags",
  query: async (_, ctx: AirflowContext) => {
    const { items: dags } = await ctx.client.listDagPage({
      limit: OVERVIEW_DAGS,
      offset: 0,
      search: "",
    });
    return Promise.all(
      dags.map(async (dag) => {
        const latestRun = (await ctx.client.listDagRuns(dag.dagId))[0];
        return {
          ...dag,
          lastRun: formatDate(latestRun?.logicalDate || latestRun?.startDate),
          nextRun: formatDate(dag.nextRun),
          status: dag.isPaused ? "paused" : "active",
          statusTone: dag.isPaused ? "muted" : "healthy",
          lastRunState: latestRun ? stateLabel(latestRun.state) : "Never run",
          lastRunTone: latestRun ? runStateTone(latestRun.state) : "muted",
          lastRunLabel: latestRun
            ? (formatDate(latestRun.logicalDate || latestRun.startDate) ?? "")
            : "",
        };
      }),
    );
  },
});
