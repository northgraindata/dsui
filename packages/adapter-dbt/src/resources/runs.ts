import {
  defineResource,
  poll,
  type ResourceRuntimeContext,
} from "@northgraindata/dsui-adapter-sdk";
import { artifactSource, readArtifact } from "../artifacts.js";
import type { DbtContext } from "../context.js";
import { listRuns } from "../run-history.js";

export const runs = defineResource({
  id: "runs",
  query: async (
    _input: undefined,
    ctx: DbtContext & ResourceRuntimeContext,
  ) => {
    if (ctx.cloud) return ctx.cloud.listRuns();
    if (ctx.config.method === "push") {
      return (await listRuns(ctx.blobs)).map((run) => ({
        cause: "Pushed from CI",
        id: run.id,
        job: "Pushed build",
        job_id: "Pushed build",
        started_at: run.startedAt,
        status: run.status,
      }));
    }
    const artifact = await readArtifact(
      artifactSource(ctx),
      "run_results.json",
    );
    if (!artifact.data) return [];
    const rows = Array.isArray(artifact.data?.results)
      ? artifact.data.results
      : [];
    if (!rows.length) return [];
    const statuses = rows.flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return [];
      const status = (value as Record<string, unknown>).status;
      return typeof status === "string" ? [status] : [];
    });
    return [
      {
        id: "local-latest",
        job: "Local dbt",
        job_id: "Local dbt",
        status: statuses.some((status) => ["error", "fail"].includes(status))
          ? "error"
          : "success",
        cause: "Local run",
        started_at:
          typeof artifact.data.metadata === "object" &&
          artifact.data.metadata !== null &&
          !Array.isArray(artifact.data.metadata) &&
          typeof (artifact.data.metadata as Record<string, unknown>)
            .generated_at === "string"
            ? ((artifact.data.metadata as Record<string, unknown>)
                .generated_at as string)
            : "",
      },
    ];
  },
  refresh: poll("30s"),
});
