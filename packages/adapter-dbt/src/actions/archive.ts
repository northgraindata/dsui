import type { ActionRuntimeContext } from "@northgraindata/dsui-adapter-sdk";
import { artifactNames, readArtifactDetail } from "../artifacts.js";
import type { DbtContext } from "../context.js";
import type { DbtLocalExecution } from "../local.js";
import { dbtRunStore } from "../stores/runs.js";

export async function archiveLocalRun(
  config: Extract<DbtContext["config"], { method: "local" }>,
  result: DbtLocalExecution,
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
