import {
  defineResource,
  type ResourceRuntimeContext,
} from "@northgraindata/dsui-adapter-sdk";
import { artifactSource, readArtifact } from "../artifacts.js";
import type { DbtContext } from "../context.js";
import { listRuns } from "../run-history.js";

type RunRow = {
  id: string;
  job: string;
  status: string;
  tone: StatusTone;
  cause: string;
  started: string;
};

type StatusTone = "healthy" | "warning" | "unavailable" | "muted";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export const dashboard = defineResource({
  id: "dashboard",
  query: async (
    _input: undefined,
    ctx: DbtContext & ResourceRuntimeContext,
  ) => {
    if (ctx.config.method === "cloud") {
      const [projects, jobs, runs] = await Promise.all([
        ctx.cloud?.listProjects(),
        ctx.cloud?.listJobs(),
        ctx.cloud?.listRuns(undefined, 100),
      ]);
      const latest = runs?.[0];
      const history = weekHistory(
        (runs ?? []).map((run) => ({
          started: run.started_at ?? "",
          status: run.status ?? "",
        })),
      );
      return {
        method: "cloud",
        models: 0,
        tests: 0,
        sources: 0,
        projects: projects?.length ?? 0,
        jobs: jobs?.length ?? 0,
        latestStatus: formatStatus(latest?.status),
        latestTone: latest?.status ? statusTone(latest.status) : "muted",
        latestDuration: runDuration(latest?.started_at, latest?.finished_at),
        latestSummary: latest
          ? `Run ${latest.id} · ${latest.cause ?? "dbt Cloud"}`
          : "No recent dbt runs",
        history,
      };
    }
    const source = artifactSource(ctx);
    const manifest = await readArtifact(source, "manifest.json");
    const results = await readArtifact(source, "run_results.json");
    const nodes = record(manifest.data?.nodes);
    const resultRows = Array.isArray(results.data?.results)
      ? results.data.results
      : [];
    const values = Object.values(nodes ?? {});
    const count = (resourceType: string) =>
      values.filter((value) => record(value)?.resource_type === resourceType)
        .length;
    const statuses = resultRows.flatMap((value) => {
      const item = record(value);
      return typeof item?.status === "string" ? [item.status] : [];
    });
    const runHistory =
      ctx.config.method === "push" ? await listRuns(ctx.blobs, 100) : [];
    const localGeneratedAt = record(results.data?.metadata)?.generated_at;
    const history = weekHistory([
      ...runHistory.map((run) => ({
        started: run.startedAt,
        status: run.status,
      })),
      ...(ctx.config.method === "local" && typeof localGeneratedAt === "string"
        ? [
            {
              started: localGeneratedAt,
              status: formatRunResultStatus(statuses),
            },
          ]
        : []),
    ]);
    const failed = statuses.filter(isErrorStatus).length;
    const warned = statuses.filter(isWarningStatus).length;
    const passed = statuses.filter(isSuccessStatus).length;
    return {
      method: ctx.config.method,
      models: count("model"),
      tests: count("test"),
      sources: count("source"),
      projects: 0,
      jobs: 0,
      latestStatus: formatRunResultStatus(statuses),
      latestTone: runResultTone(statuses),
      latestDuration: formatElapsed(
        record(results.data?.metadata)?.elapsed_time,
      ),
      latestSummary: statuses.length
        ? [
            `${statuses.length} nodes`,
            `${passed} passed`,
            ...(warned ? [`${warned} warnings`] : []),
            ...(failed ? [`${failed} errors`] : []),
          ].join(" · ")
        : "No run results yet",
      history,
    };
  },
});

export const recentRuns = defineResource({
  id: "recent-runs",
  query: async (
    _input: undefined,
    ctx: DbtContext & ResourceRuntimeContext,
  ): Promise<RunRow[]> => {
    if (ctx.cloud) {
      const runs = await ctx.cloud.listRuns(undefined, 10);
      return runs.slice(0, 10).map((run) => ({
        id: run.id,
        job: run.job_id,
        status: formatStatus(run.status),
        tone: statusTone(formatStatus(run.status)),
        cause: run.cause ?? "",
        started: formatStarted(run.started_at ?? ""),
      }));
    }

    if (ctx.config.method === "push") {
      return (await listRuns(ctx.blobs, 10)).map((run) => ({
        cause: "Pushed from CI",
        id: run.id,
        job: "Pushed build",
        started: formatStarted(run.startedAt),
        status: formatStatus(run.status),
        tone: statusTone(run.status),
      }));
    }

    const results = await readArtifact(artifactSource(ctx), "run_results.json");
    const rows = Array.isArray(results.data?.results)
      ? results.data.results
      : [];
    if (!rows.length) return [];
    const statuses = rows.flatMap((value) => {
      const item = record(value);
      return typeof item?.status === "string" ? [item.status] : [];
    });
    const metadata = record(results.data?.metadata);
    return [
      {
        id: "local-latest",
        job: "Local dbt",
        status: formatRunResultStatus(statuses),
        tone: runResultTone(statuses),
        cause: "Local run",
        started: formatStarted(
          typeof metadata?.generated_at === "string"
            ? metadata.generated_at
            : "",
        ),
      },
    ];
  },
});

function formatStatus(status: string | undefined): string {
  if (!status) return "No runs";
  const normalized = status.toLowerCase();
  if (
    normalized === "success" ||
    normalized === "pass" ||
    normalized === "passed"
  )
    return "Success";
  if (isErrorStatus(status)) return "Failed";
  if (isWarningStatus(status)) return "Warning";
  if (normalized === "skipped") return "Skipped";
  return status.replaceAll("_", " ");
}

type RunHistoryDay = {
  date: string;
  label: string;
  success: number;
  warning: number;
  error: number;
};

function weekHistory(runs: readonly { started: string; status: string }[]) {
  const days: RunHistoryDay[] = [];
  const today = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - offset,
      ),
    );
    days.push({
      date: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date),
      success: 0,
      warning: 0,
      error: 0,
    });
  }
  for (const run of runs) {
    const day = days.find((item) => item.date === run.started.slice(0, 10));
    if (!day) continue;
    if (isErrorStatus(run.status)) day.error += 1;
    else if (isWarningStatus(run.status)) day.warning += 1;
    else day.success += 1;
  }
  return days;
}

function runDuration(started?: string, finished?: string): string {
  if (!started || !finished) return "";
  const elapsed = Date.parse(finished) - Date.parse(started);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "";
  return `${Math.round(elapsed / 1000)}s`;
}

function formatElapsed(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value.toFixed(1)}s`
    : "";
}

function formatStarted(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "UTC",
      }).format(date);
}

function isWarningStatus(status: string): boolean {
  return /\b(warn|warned|warning)\b/.test(status.toLowerCase());
}

function isSuccessStatus(status: string): boolean {
  return /\b(success|pass|passed|succeeded)\b/.test(status.toLowerCase());
}

function formatRunResultStatus(statuses: string[]): string {
  if (!statuses.length) return "No runs";
  if (statuses.some(isErrorStatus)) return "Failed";
  if (statuses.some(isWarningStatus)) return "Warning";
  return "Success";
}

function runResultTone(statuses: string[]): StatusTone {
  if (!statuses.length) return "muted";
  if (statuses.some(isErrorStatus)) return "unavailable";
  if (statuses.some(isWarningStatus)) return "warning";
  return "healthy";
}

function statusTone(status: string): StatusTone {
  const normalized = status.toLowerCase();
  if (
    normalized === "success" ||
    normalized === "pass" ||
    normalized === "passed"
  )
    return "healthy";
  if (isErrorStatus(status)) return "unavailable";
  if (normalized === "skipped" || normalized === "not run") return "muted";
  if (isWarningStatus(status)) return "warning";
  return normalized === "no runs" ? "muted" : "warning";
}

function isErrorStatus(status: string): boolean {
  const normalized = status.toLowerCase().replaceAll("_", " ");
  return /\b(error|errored|fail|failed|failure)\b/.test(normalized);
}
