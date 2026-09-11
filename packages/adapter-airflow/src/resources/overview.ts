import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";

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

export const overviewDags = defineResource({
  id: "overview-dags",
  query: async (_, ctx: AirflowContext) => {
    const dags = await ctx.client.listDags();
    return Promise.all(
      dags.map(async (dag) => {
        const latestRun = (await ctx.client.listDagRuns(dag.dagId))[0];
        return {
          ...dag,
          lastRun: formatDate(latestRun?.logicalDate || latestRun?.startDate),
          nextRun: formatDate(dag.nextRun),
          status: dag.isPaused ? "paused" : "active",
          statusTone: dag.isPaused ? "muted" : "healthy",
        };
      }),
    );
  },
});
