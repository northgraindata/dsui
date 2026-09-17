import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import { readArtifact } from "../artifacts.js";
import type { DbtContext } from "../context.js";

type RunRow = {
  id: string;
  job: string;
  status: string;
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
  query: async (_input: undefined, ctx: DbtContext) => {
    if (ctx.config.method === "cloud") {
      const [projects, jobs, runs] = await Promise.all([
        ctx.cloud?.listProjects(),
        ctx.cloud?.listJobs(),
        ctx.cloud?.listRuns(),
      ]);
      const latest = runs?.[0];
      return {
        models: 0,
        tests: 0,
        sources: 0,
        projects: projects?.length ?? 0,
        jobs: jobs?.length ?? 0,
        latestStatus: formatStatus(latest?.status),
        latestDuration: "",
        segments: statusSegments(runs?.map((run) => run.status)),
      };
    }
    const manifest = await readArtifact(ctx.config, "manifest.json");
    const results = await readArtifact(ctx.config, "run_results.json");
    const nodes = record(manifest.data?.nodes);
    const resultRows = Array.isArray(results.data?.results)
      ? results.data.results
      : [];
    const values = Object.values(nodes ?? {});
    const count = (resourceType: string) =>
      values.filter((value) => record(value)?.resource_type === resourceType)
        .length;
    const latestRecord = record(resultRows.at(-1));
    const statuses = resultRows.flatMap((value) => {
      const item = record(value);
      return typeof item?.status === "string" ? [item.status] : [];
    });
    return {
      models: count("model"),
      tests: count("test"),
      sources: count("source"),
      projects: 0,
      jobs: 0,
      latestStatus: formatStatus(
        statuses.some((status) => ["error", "fail"].includes(status))
          ? "error"
          : statuses.length
            ? "success"
            : undefined,
      ),
      latestDuration:
        typeof latestRecord?.execution_time === "number"
          ? `${latestRecord.execution_time.toFixed(1)}s`
          : "",
      segments: statusSegments(statuses),
    };
  },
});

export const recentRuns = defineResource({
  id: "recent-runs",
  query: async (_input: undefined, ctx: DbtContext): Promise<RunRow[]> => {
    if (ctx.cloud) {
      const runs = await ctx.cloud.listRuns();
      return runs.slice(0, 10).map((run) => ({
        id: run.id,
        job: run.job_id,
        status: formatStatus(run.status),
        cause: run.cause ?? "",
        started: run.started_at ?? "",
      }));
    }

    if (ctx.config.method !== "local") return [];
    const results = await readArtifact(ctx.config, "run_results.json");
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
        status: formatStatus(
          statuses.some((status) => ["error", "fail"].includes(status))
            ? "error"
            : "success",
        ),
        cause: "Local run",
        started:
          typeof metadata?.generated_at === "string"
            ? metadata.generated_at
            : "",
      },
    ];
  },
});

function statusSegments(statuses: Array<string | undefined> | undefined) {
  const counts = new Map<string, { value: number; tone: StatusTone }>();
  for (const status of statuses ?? []) {
    if (!status) continue;
    const label = formatStatus(status);
    const current = counts.get(label);
    counts.set(label, {
      value: (current?.value ?? 0) + 1,
      tone: statusTone(status),
    });
  }
  return [...counts.entries()].map(([label, segment]) => ({
    label,
    ...segment,
  }));
}

function formatStatus(status: string | undefined): string {
  if (!status) return "No runs";
  const normalized = status.toLowerCase();
  if (
    normalized === "success" ||
    normalized === "pass" ||
    normalized === "passed"
  )
    return "Success";
  if (
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "fail"
  )
    return "Failed";
  if (normalized === "skipped") return "Skipped";
  return status.replaceAll("_", " ");
}

function statusTone(status: string): StatusTone {
  const normalized = status.toLowerCase();
  if (
    normalized === "success" ||
    normalized === "pass" ||
    normalized === "passed"
  )
    return "healthy";
  if (
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "fail"
  )
    return "unavailable";
  if (normalized === "skipped") return "muted";
  return "warning";
}
