import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { artifactNames, readArtifactDetail } from "../artifacts.js";
import type { DbtContext } from "../context.js";
import { dbtRunStore } from "../stores/runs.js";

async function archiveLocalRun(
  config: Extract<DbtContext["config"], { method: "local" }>,
  result: Awaited<ReturnType<NonNullable<DbtContext["local"]>["execute"]>>,
  ctx: ActionRuntimeContext,
) {
  const id = `local-${Date.now()}`;
  const artifacts = await Promise.all(
    artifactNames.map(async (name) => {
      const artifact = await readArtifactDetail(config, name);
      if (!artifact.content) return undefined;
      return {
        name,
        contentType: "application/json" as const,
        size: Buffer.byteLength(artifact.content, "utf8"),
        content: artifact.content,
      };
    }),
  );
  const store = ctx.stores.get(dbtRunStore);
  store.actions.addRun({
    id,
    job: "Local dbt",
    jobId: "Local dbt",
    status: result.exitCode === 0 ? "success" : "error",
    cause: "Triggered from DSUI",
    startedAt: new Date(Date.now() - result.durationMs).toISOString(),
    durationMs: result.durationMs,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    artifacts: artifacts.filter(
      (artifact): artifact is NonNullable<(typeof artifacts)[number]> =>
        Boolean(artifact),
    ),
  });
  await store.flush();
  ctx.invalidate();
  return id;
}

export const runBuild = defineAction({
  id: "run-build",
  input: z.object({ jobId: z.string().min(1).optional() }),
  run: async (input, ctx: DbtContext & ActionRuntimeContext) => {
    if (ctx.local && ctx.config.method === "local") {
      const result = await ctx.local.execute("build", {}, ctx.signal);
      const runId = await archiveLocalRun(ctx.config, result, ctx);
      return { ...result, runId };
    }
    if (!ctx.cloud) throw new Error("Unsupported dbt connection");
    const jobId =
      input.jobId ??
      (ctx.config.method === "cloud" ? ctx.config.jobId : undefined) ??
      (await ctx.cloud.listJobs(ctx.signal))[0]?.id;
    if (!jobId)
      throw new Error("No dbt Cloud job is configured for this connection");
    const run = await ctx.cloud.triggerJob(
      jobId,
      { cause: "Triggered from DSUI", stepsOverride: ["dbt build"] },
      ctx.signal,
    );
    return { ...run, runId: run.id };
  },
});
