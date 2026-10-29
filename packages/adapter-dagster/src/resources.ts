import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { DagsterContext, DagsterRun } from "./context.js";

export const assetInput = z.object({ id: z.string().min(1) });

function assetRow(asset: import("./context.js").DagsterAsset) {
  return {
    ...asset,
    jobs: asset.jobNames.join(", ") || "—",
    ownerNames: asset.owners.join(", ") || "—",
    upstream: asset.upstreamIds.length,
    downstream: asset.downstreamIds.length,
    materializedAt: asset.latestMaterialization
      ? new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(Number(asset.latestMaterialization))
      : "Never",
    checks: asset.hasAssetChecks ? "Configured" : "—",
  };
}

export const assets = defineResource({
  id: "assets",
  query: async (_, ctx: DagsterContext) =>
    (await ctx.client.listAssets()).map(assetRow),
  refresh: poll("30s"),
});

export const assetDetails = defineResource({
  id: "asset-details",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const asset = (await ctx.client.listAssets()).find(
      (item) => item.id === id,
    );
    if (!asset) throw new Error("Dagster asset was not found");
    return [assetRow(asset)];
  },
  refresh: poll("30s"),
});

export const assetUpstream = defineResource({
  id: "asset-upstream",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const catalog = await ctx.client.listAssets();
    const asset = catalog.find((item) => item.id === id);
    if (!asset) throw new Error("Dagster asset was not found");
    return catalog
      .filter((item) => asset.upstreamIds.includes(item.id))
      .map(assetRow);
  },
  refresh: poll("30s"),
});

export const assetDownstream = defineResource({
  id: "asset-downstream",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const catalog = await ctx.client.listAssets();
    const asset = catalog.find((item) => item.id === id);
    if (!asset) throw new Error("Dagster asset was not found");
    return catalog
      .filter((item) => asset.downstreamIds.includes(item.id))
      .map(assetRow);
  },
  refresh: poll("30s"),
});

export const jobInput = z.object({
  repositoryLocationName: z.string().min(1),
  repositoryName: z.string().min(1),
  name: z.string().min(1),
});
export const runInput = z.object({ runId: z.string().min(1) });

function displayTime(value: number | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value * 1000);
}

function statusTone(status: string) {
  switch (status) {
    case "SUCCESS":
      return "healthy";
    case "FAILURE":
    case "CANCELED":
      return "unavailable";
    case "STARTED":
    case "STARTING":
    case "QUEUED":
      return "info";
    default:
      return "muted";
  }
}

function runRow(run: DagsterRun) {
  return {
    ...run,
    startedAt: displayTime(run.startTime),
    endedAt: displayTime(run.endTime),
    statusTone: statusTone(run.status),
  };
}

export const overview = defineResource({
  id: "overview",
  query: async (_, ctx: DagsterContext) => {
    const [jobs, runs] = await Promise.all([
      ctx.client.listJobs(),
      ctx.client.listRuns(),
    ]);
    return {
      totalJobs: jobs.length,
      totalRuns: runs.length,
      successfulRuns: runs.filter((run) => run.status === "SUCCESS").length,
      failedRuns: runs.filter((run) => run.status === "FAILURE").length,
    };
  },
  refresh: poll("10s"),
});

export const jobs = defineResource({
  id: "jobs",
  query: async (_, ctx: DagsterContext) => {
    const [allJobs, runs] = await Promise.all([
      ctx.client.listJobs(),
      ctx.client.listRuns(),
    ]);
    return allJobs.map((job) => {
      const latest = runs.find((run) => run.jobName === job.name);
      return {
        ...job,
        latestStatus: latest?.status ?? "Never run",
        latestStatusTone: latest ? statusTone(latest.status) : "muted",
        lastRun: latest ? displayTime(latest.startTime) : "—",
      };
    });
  },
  refresh: poll("10s"),
});

export const jobDetails = defineResource({
  id: "job-details",
  input: jobInput,
  query: async (input, ctx: DagsterContext) => {
    const job = (await ctx.client.listJobs()).find(
      (candidate) =>
        candidate.name === input.name &&
        candidate.repositoryName === input.repositoryName &&
        candidate.repositoryLocationName === input.repositoryLocationName,
    );
    if (!job) throw new Error(`Dagster job ${input.name} was not found`);
    return [job];
  },
});

export const jobSteps = defineResource({
  id: "job-steps",
  input: jobInput,
  query: (input, ctx: DagsterContext) => ctx.client.getJobSteps(input),
});

export const runs = defineResource({
  id: "runs",
  query: async (_, ctx: DagsterContext) =>
    (await ctx.client.listRuns()).map(runRow),
  refresh: poll("5s"),
});

export const jobRuns = defineResource({
  id: "job-runs",
  input: jobInput,
  query: async ({ name }, ctx: DagsterContext) =>
    (await ctx.client.listRuns())
      .filter((run) => run.jobName === name)
      .map(runRow),
  refresh: poll("5s"),
});

export const runDetails = defineResource({
  id: "run-details",
  input: runInput,
  query: async ({ runId }, ctx: DagsterContext) => [
    runRow(await ctx.client.getRun(runId)),
  ],
  refresh: poll("3s"),
});

export const runLogs = defineResource({
  id: "run-logs",
  input: runInput,
  query: ({ runId }, ctx: DagsterContext) => ctx.client.getRunLogs(runId),
  refresh: poll("3s"),
});
