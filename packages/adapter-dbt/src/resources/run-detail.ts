import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import { readArtifact, readArtifacts, readLocalRunLog } from "../artifacts.js";
import type { DbtContext } from "../context.js";

const input = z.object({ runId: z.string().min(1) });

export const runDetail = defineResource({
  id: "run-detail",
  input,
  query: async ({ runId }, ctx: DbtContext) => {
    if (ctx.cloud) return ctx.cloud.getRun(runId);
    if (ctx.config.method !== "local")
      throw new Error("Unsupported dbt connection");
    const artifact = await readArtifact(ctx.config, "run_results.json");
    if (runId === "local-latest") {
      const rows = Array.isArray(artifact.data?.results)
        ? artifact.data.results
        : [];
      const statuses = rows.flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return [];
        const status = (value as Record<string, unknown>).status;
        return typeof status === "string" ? [status] : [];
      });
      return {
        id: "local-latest",
        status:
          statuses.includes("error") || statuses.includes("fail")
            ? "error"
            : "success",
        resultCount: rows.length,
      };
    }
    const row = Array.isArray(artifact.data?.results)
      ? artifact.data.results.find(
          (value) =>
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            (value as Record<string, unknown>).unique_id === runId,
        )
      : undefined;
    if (!row) throw new Error(`Local dbt run not found: ${runId}`);
    return row;
  },
});

export const runLogs = defineResource({
  id: "run-logs",
  input,
  query: async ({ runId }, ctx: DbtContext) => {
    if (ctx.cloud) {
      const content = await ctx.cloud.getRunLogs(runId);
      return { content };
    }
    if (ctx.config.method !== "local")
      throw new Error("Unsupported dbt connection");
    const content = await readLocalRunLog(ctx.config);
    if (content) return { content };
    const results = await readArtifact(ctx.config, "run_results.json");
    return {
      content: results.data
        ? JSON.stringify(results.data, null, 2)
        : "No dbt log or run_results.json has been generated yet.",
    };
  },
});

export const runArtifacts = defineResource({
  id: "run-artifacts",
  input,
  query: async ({ runId }, ctx: DbtContext) => {
    if (ctx.cloud) return ctx.cloud.listArtifacts(runId);
    if (ctx.config.method !== "local")
      throw new Error("Unsupported dbt connection");
    const artifacts = await readArtifacts(ctx.config);
    return artifacts
      .filter((artifact) => artifact.present)
      .map((artifact) => ({
        name: artifact.name,
        content_type: "application/json",
        size: undefined,
      }));
  },
});
