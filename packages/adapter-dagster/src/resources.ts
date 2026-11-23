import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type {
  DagsterAsset,
  DagsterAssetCheck,
  DagsterContext,
  DagsterJob,
  DagsterRun,
} from "./context.js";

export const assetInput = z.object({ id: z.string().min(1) });
export const jobInput = z.object({
  repositoryLocationName: z.string().min(1),
  repositoryName: z.string().min(1),
  name: z.string().min(1),
});
export const runInput = z.object({ runId: z.string().min(1) });

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function displayMillis(value: number | null): string {
  return value === null ? "—" : dateTime.format(value);
}

function displayTime(value: number | null): string {
  return displayMillis(value === null ? null : value * 1000);
}

function relativeTime(millis: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - millis) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function duration(start: number | null, end: number | null): string {
  if (start === null) return "—";
  const seconds = Math.max(0, Math.round((end ?? Date.now() / 1000) - start));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}m ${seconds % 60}s`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
    case "CANCELING":
      return "info";
    default:
      return "muted";
  }
}

/** One status for an asset, combining runs, materializations, and staleness. */
export function assetStatus(asset: DagsterAsset) {
  if (asset.inProgress)
    return { state: "materializing", label: "Materializing", tone: "info" };
  if (
    asset.latestRun &&
    ["FAILURE", "CANCELED"].includes(asset.latestRun.status) &&
    asset.latestRun.runId !== asset.latestRunId
  )
    return { state: "failed", label: "Failed", tone: "unavailable" };
  if (!asset.isMaterializable)
    return { state: "source", label: "Source", tone: "muted" };
  if (!asset.latestMaterialization)
    return { state: "missing", label: "Never materialized", tone: "muted" };
  if (asset.staleStatus === "STALE")
    return { state: "stale", label: "Stale", tone: "warning" };
  return { state: "materialized", label: "Materialized", tone: "healthy" };
}

function checkOutcome(check: DagsterAssetCheck) {
  switch (check.status) {
    case "SUCCEEDED":
      return { label: "Passed", tone: "healthy" };
    case "FAILED":
      return check.severity === "WARN"
        ? { label: "Warning", tone: "warning" }
        : { label: "Failed", tone: "unavailable" };
    case "EXECUTION_FAILED":
      return { label: "Errored", tone: "unavailable" };
    case "IN_PROGRESS":
      return { label: "Running", tone: "info" };
    case "SKIPPED":
      return { label: "Skipped", tone: "muted" };
    default:
      return { label: "Not executed", tone: "muted" };
  }
}

/** Worst check outcome first, as shown on graph nodes and in tables. */
export function checkSummary(checks: readonly DagsterAssetCheck[]) {
  if (!checks.length) return { state: undefined, label: "—" };
  const tones = checks.map((check) => checkOutcome(check).tone);
  const passed = tones.filter((tone) => tone === "healthy").length;
  const label = `${passed}/${checks.length} passing`;
  if (tones.includes("unavailable")) return { state: "failing", label };
  if (tones.includes("warning")) return { state: "warning", label };
  if (passed === checks.length) return { state: "passing", label };
  return { state: "pending", label };
}

function materializedAt(asset: DagsterAsset): number | null {
  return asset.latestMaterialization === null
    ? null
    : Number(asset.latestMaterialization);
}

function assetRow(asset: DagsterAsset) {
  const status = assetStatus(asset);
  const at = materializedAt(asset);
  return {
    id: asset.id,
    name: asset.name,
    description: asset.description,
    group: asset.group,
    kinds: asset.kinds.join(", ") || "—",
    repositoryName: asset.repositoryName,
    repositoryLocationName: asset.repositoryLocationName,
    jobs: asset.jobNames.join(", ") || "—",
    ownerNames: asset.owners.join(", ") || "—",
    tags: asset.tags.join(", ") || "—",
    upstream: asset.upstreamIds.length,
    downstream: asset.downstreamIds.length,
    status: status.label,
    statusTone: status.tone,
    materializedAt: displayMillis(at),
    latestRunId: asset.latestRunId ?? "",
    checks: checkSummary(asset.checks).label,
    partitioned: asset.isPartitioned ? "Yes" : "No",
    materializable: asset.isMaterializable,
  };
}

/** Graph row for the lineage component; see `AssetGraphProps`. */
function assetNode(asset: DagsterAsset, visible: ReadonlySet<string>) {
  const status = assetStatus(asset);
  const at = materializedAt(asset);
  const checks = checkSummary(asset.checks);
  return {
    id: asset.id,
    label: asset.name,
    dependsOn: asset.upstreamIds.filter((id) => visible.has(id)),
    group: asset.group,
    kinds: asset.kinds,
    state: status.state,
    stateLabel: status.label,
    caption: at === null ? undefined : relativeTime(at),
    description: asset.description,
    checkState: checks.state,
    checkLabel: `Checks: ${checks.label}`,
    details: {
      Owners: asset.owners.join(", "),
      Jobs: asset.jobNames.join(", "),
      "Last materialized": at === null ? "" : displayMillis(at),
      Checks: asset.checks.length ? checks.label : "",
      Tags: asset.tags.join(", "),
      Repository: `${asset.repositoryName}@${asset.repositoryLocationName}`,
    },
    repositoryName: asset.repositoryName,
    repositoryLocationName: asset.repositoryLocationName,
    materializable: asset.isMaterializable,
    external: false,
  };
}

/** Graph rows for a selection, plus its direct neighbours as context. */
function selectionGraph(
  catalog: readonly DagsterAsset[],
  selected: ReadonlySet<string>,
) {
  const context = new Set<string>();
  for (const asset of catalog) {
    if (!selected.has(asset.id)) continue;
    for (const id of [...asset.upstreamIds, ...asset.downstreamIds])
      if (!selected.has(id)) context.add(id);
  }
  const visible = new Set([...selected, ...context]);
  return catalog
    .filter((asset) => visible.has(asset.id))
    .map((asset) => ({
      ...assetNode(asset, visible),
      external: context.has(asset.id),
    }));
}

/** Every ancestor and descendant of one asset. */
function lineageOf(catalog: readonly DagsterAsset[], id: string): Set<string> {
  const byId = new Map(catalog.map((asset) => [asset.id, asset]));
  const walk = (start: string, next: (asset: DagsterAsset) => string[]) => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const current = byId.get(queue.pop() ?? "");
      if (!current) continue;
      for (const neighbour of next(current))
        if (!seen.has(neighbour)) {
          seen.add(neighbour);
          queue.push(neighbour);
        }
    }
    return seen;
  };
  return new Set([
    id,
    ...walk(id, (asset) => asset.upstreamIds),
    ...walk(id, (asset) => asset.downstreamIds),
  ]);
}

async function findAsset(ctx: DagsterContext, id: string) {
  const catalog = await ctx.client.listAssets();
  const asset = catalog.find((item) => item.id === id);
  if (!asset) throw new Error("Dagster asset was not found");
  return { asset, catalog };
}

export const assets = defineResource({
  id: "assets",
  query: async (_, ctx: DagsterContext) =>
    (await ctx.client.listAssets()).map(assetRow),
  refresh: poll("30s"),
});

export const assetGraph = defineResource({
  id: "asset-graph",
  query: async (_, ctx: DagsterContext) => {
    const catalog = await ctx.client.listAssets();
    const visible = new Set(catalog.map((asset) => asset.id));
    return catalog.map((asset) => assetNode(asset, visible));
  },
});

export const assetDetails = defineResource({
  id: "asset-details",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const { asset } = await findAsset(ctx, id);
    return [assetRow(asset)];
  },
  refresh: poll("30s"),
});

export const assetLineage = defineResource({
  id: "asset-lineage",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const { catalog } = await findAsset(ctx, id);
    const visible = lineageOf(catalog, id);
    return catalog
      .filter((asset) => visible.has(asset.id))
      .map((asset) => assetNode(asset, visible));
  },
});

export const assetUpstream = defineResource({
  id: "asset-upstream",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const { asset, catalog } = await findAsset(ctx, id);
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
    const { asset, catalog } = await findAsset(ctx, id);
    return catalog
      .filter((item) => asset.downstreamIds.includes(item.id))
      .map(assetRow);
  },
  refresh: poll("30s"),
});

export const assetChecks = defineResource({
  id: "asset-checks",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const { asset } = await findAsset(ctx, id);
    return asset.checks.map((check) => {
      const outcome = checkOutcome(check);
      return {
        name: check.name,
        description: check.description || "—",
        blocking: check.blocking ? "Blocking" : "—",
        result: outcome.label,
        resultTone: outcome.tone,
        executedAt: displayTime(check.timestamp),
        runId: check.runId ?? "",
      };
    });
  },
  refresh: poll("15s"),
});

export const assetHistory = defineResource({
  id: "asset-history",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const { asset } = await findAsset(ctx, id);
    return (await ctx.client.getAssetHistory(asset.path)).map((event) => ({
      ...event,
      materializedAt: displayMillis(Number(event.timestamp)),
      ago: relativeTime(Number(event.timestamp)),
    }));
  },
  refresh: poll("15s"),
});

function jobRow(job: DagsterJob, runs: readonly DagsterRun[]) {
  const latest = runs.find((run) => run.jobName === job.name);
  return {
    ...job,
    type: job.isAssetJob ? "Assets" : "Ops",
    latestStatus: latest?.status ?? "Never run",
    latestStatusTone: latest ? statusTone(latest.status) : "muted",
    lastRun: latest ? displayTime(latest.startTime) : "—",
  };
}

export const assetJobs = defineResource({
  id: "asset-jobs",
  input: assetInput,
  query: async ({ id }, ctx: DagsterContext) => {
    const [{ asset }, allJobs, runs] = await Promise.all([
      findAsset(ctx, id),
      ctx.client.listJobs(),
      ctx.client.listRuns(),
    ]);
    return allJobs
      .filter(
        (job) =>
          asset.jobNames.includes(job.name) &&
          job.repositoryName === asset.repositoryName &&
          job.repositoryLocationName === asset.repositoryLocationName,
      )
      .map((job) => jobRow(job, runs));
  },
  refresh: poll("10s"),
});

function runRow(run: DagsterRun) {
  return {
    ...run,
    startedAt: displayTime(run.startTime),
    endedAt: displayTime(run.endTime),
    duration: duration(run.startTime, run.endTime),
    statusTone: statusTone(run.status),
  };
}

export const overview = defineResource({
  id: "overview",
  query: async (_, ctx: DagsterContext) => {
    const [jobs, runs, catalog, schedules, sensors] = await Promise.all([
      ctx.client.listJobs(),
      ctx.client.listRuns(),
      ctx.client.listAssets(),
      ctx.client.listSchedules(),
      ctx.client.listSensors(),
    ]);
    const statuses = catalog.map((asset) => assetStatus(asset).state);
    return {
      totalAssets: catalog.length,
      staleAssets: statuses.filter((state) =>
        ["stale", "failed", "missing"].includes(state),
      ).length,
      failingChecks: catalog.filter(
        (asset) => checkSummary(asset.checks).state === "failing",
      ).length,
      totalJobs: jobs.length,
      totalRuns: runs.length,
      successfulRuns: runs.filter((run) => run.status === "SUCCESS").length,
      failedRuns: runs.filter((run) => run.status === "FAILURE").length,
      runningAutomations:
        schedules.filter((item) => item.status === "RUNNING").length +
        sensors.filter((item) => item.status === "RUNNING").length,
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
    return allJobs.map((job) => jobRow(job, runs));
  },
  refresh: poll("10s"),
});

async function findJob(ctx: DagsterContext, input: z.output<typeof jobInput>) {
  const job = (await ctx.client.listJobs()).find(
    (candidate) =>
      candidate.name === input.name &&
      candidate.repositoryName === input.repositoryName &&
      candidate.repositoryLocationName === input.repositoryLocationName,
  );
  if (!job) throw new Error(`Dagster job ${input.name} was not found`);
  return job;
}

export const jobDetails = defineResource({
  id: "job-details",
  input: jobInput,
  query: async (input, ctx: DagsterContext) => {
    const job = await findJob(ctx, input);
    return [{ ...job, type: job.isAssetJob ? "Assets" : "Ops" }];
  },
});

function jobAssetIds(catalog: readonly DagsterAsset[], job: DagsterJob) {
  return new Set(
    catalog
      .filter(
        (asset) =>
          asset.jobNames.includes(job.name) &&
          asset.repositoryName === job.repositoryName &&
          asset.repositoryLocationName === job.repositoryLocationName,
      )
      .map((asset) => asset.id),
  );
}

/**
 * Asset jobs show their assets with upstream and downstream neighbours
 * from other jobs; op jobs show their op graph.
 */
export const jobGraph = defineResource({
  id: "job-graph",
  input: jobInput,
  query: async (input, ctx: DagsterContext) => {
    const job = await findJob(ctx, input);
    if (job.isAssetJob) {
      const catalog = await ctx.client.listAssets();
      return selectionGraph(catalog, jobAssetIds(catalog, job));
    }
    return (await ctx.client.getJobOps(job)).map((op) => ({
      id: op.name,
      label: op.name,
      dependsOn: op.dependsOn,
      kinds: op.isDynamicMapped ? ["op", "dynamic"] : ["op"],
      details: { "Depends on": op.dependsOn.join(", ") },
    }));
  },
});

export const jobAssets = defineResource({
  id: "job-assets",
  input: jobInput,
  query: async (input, ctx: DagsterContext) => {
    const job = await findJob(ctx, input);
    const catalog = await ctx.client.listAssets();
    const ids = jobAssetIds(catalog, job);
    return catalog.filter((asset) => ids.has(asset.id)).map(assetRow);
  },
  refresh: poll("15s"),
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
  query: async ({ runId }, ctx: DagsterContext) => {
    const run = await ctx.client.getRun(runId);
    return [
      {
        ...runRow(run),
        repositoryName: run.repositoryName,
        repositoryLocationName: run.repositoryLocationName,
        steps: run.steps.length,
        assetsMaterialized: run.materializedAssetIds.length,
      },
    ];
  },
  refresh: poll("3s"),
});

function stepState(status: string | null, runStatus: string) {
  switch (status) {
    case "SUCCESS":
      return { state: "success", label: "Succeeded" };
    case "FAILURE":
      return { state: "failed", label: "Failed" };
    case "IN_PROGRESS":
      return { state: "running", label: "Running" };
    case "SKIPPED":
      return { state: "skipped", label: "Skipped" };
    default:
      return ["QUEUED", "STARTING", "STARTED", "NOT_STARTED"].includes(
        runStatus,
      )
        ? { state: "queued", label: "Waiting" }
        : { state: "skipped", label: "Not executed" };
  }
}

/** The run's job graph, coloured by each step's outcome in this run. */
export const runGraph = defineResource({
  id: "run-graph",
  input: runInput,
  query: async ({ runId }, ctx: DagsterContext) => {
    const run = await ctx.client.getRun(runId);
    if (!run.repositoryName) return [];
    const [ops, catalog] = await Promise.all([
      ctx.client.getJobOps({
        name: run.jobName,
        repositoryName: run.repositoryName,
        repositoryLocationName: run.repositoryLocationName,
      }),
      ctx.client.listAssets(),
    ]);
    // Dagster names an asset's op after its key, joined with "__".
    const assetsByOp = new Map(
      catalog.map((asset) => [asset.path.join("__"), asset]),
    );
    const steps = new Map(run.steps.map((step) => [step.stepKey, step]));
    // Asset subsets only execute some ops; the rest add noise, not lineage.
    const planned = run.plannedStepKeys && new Set(run.plannedStepKeys);
    const shown = planned ? ops.filter((op) => planned.has(op.name)) : ops;
    const names = new Set(shown.map((op) => op.name));
    return shown.map((op) => {
      const step = steps.get(op.name);
      const state = stepState(step?.status ?? null, run.status);
      return {
        id: op.name,
        label: op.name,
        dependsOn: op.dependsOn.filter((name) => names.has(name)),
        kinds: assetsByOp.get(op.name)?.kinds ?? ["op"],
        group: assetsByOp.get(op.name)?.group,
        state: state.state,
        stateLabel: state.label,
        caption: step ? duration(step.startTime, step.endTime) : undefined,
        details: {
          Started: step ? displayTime(step.startTime) : "",
          Ended: step ? displayTime(step.endTime) : "",
          Duration: step ? duration(step.startTime, step.endTime) : "",
        },
      };
    });
  },
  refresh: poll("3s"),
});

export const runAssets = defineResource({
  id: "run-assets",
  input: runInput,
  query: async ({ runId }, ctx: DagsterContext) => {
    const [run, catalog] = await Promise.all([
      ctx.client.getRun(runId),
      ctx.client.listAssets(),
    ]);
    const ids = new Set(run.materializedAssetIds);
    return catalog.filter((asset) => ids.has(asset.id)).map(assetRow);
  },
  refresh: poll("5s"),
});

export const runLogs = defineResource({
  id: "run-logs",
  input: runInput,
  query: ({ runId }, ctx: DagsterContext) => ctx.client.getRunLogs(runId),
  refresh: poll("3s"),
});

function automationTone(status: string) {
  return status === "RUNNING" ? "healthy" : "muted";
}

export const schedules = defineResource({
  id: "schedules",
  query: async (_, ctx: DagsterContext) =>
    (await ctx.client.listSchedules()).map((schedule) => ({
      ...schedule,
      running: schedule.status === "RUNNING",
      statusLabel: schedule.status === "RUNNING" ? "Running" : "Stopped",
      statusTone: automationTone(schedule.status),
      cron: `${schedule.cronSchedule} (${schedule.timezone})`,
      nextTickAt:
        schedule.status === "RUNNING" ? displayTime(schedule.nextTick) : "—",
      lastTickAt: schedule.lastTick
        ? `${displayTime(schedule.lastTick.timestamp)} · ${schedule.lastTick.status.toLowerCase()}`
        : "—",
    })),
  refresh: poll("10s"),
});

export const sensors = defineResource({
  id: "sensors",
  query: async (_, ctx: DagsterContext) =>
    (await ctx.client.listSensors()).map((sensor) => ({
      ...sensor,
      jobs: sensor.jobNames.join(", ") || "—",
      running: sensor.status === "RUNNING",
      statusLabel: sensor.status === "RUNNING" ? "Running" : "Stopped",
      statusTone: automationTone(sensor.status),
      type: sensor.sensorType.toLowerCase().replaceAll("_", " "),
      interval: `${sensor.minIntervalSeconds}s`,
      lastTickAt: sensor.lastTick
        ? `${displayTime(sensor.lastTick.timestamp)} · ${sensor.lastTick.status.toLowerCase()}`
        : "—",
      lastResult: sensor.lastTick?.skipReason || "—",
    })),
  refresh: poll("10s"),
});
