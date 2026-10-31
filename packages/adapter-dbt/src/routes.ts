import {
  defineRoute,
  RouteError,
  routeJson,
} from "@northgraindata/dsui-adapter-sdk";
import {
  type ArtifactName,
  artifactNames,
  pushedArtifactKey,
} from "./artifacts.js";
import type { DbtContext } from "./context.js";
import { localRunResults, localRunSignal } from "./jobs.js";
import { archiveRun } from "./run-history.js";

/** A large project's manifest.json runs to tens of megabytes. */
const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;

function artifactName(value: string | undefined): ArtifactName {
  const name = artifactNames.find((candidate) => candidate === value);
  if (!name)
    throw new RouteError(
      404,
      `Unknown artifact "${value}". Expected one of: ${artifactNames.join(", ")}`,
    );
  return name;
}

/**
 * `PUT /artifacts/:name`: CI uploads one dbt artifact after a build.
 *
 * One file per request keeps the upload streamable and trivial from a shell
 * (`curl --data-binary @target/manifest.json`). The latest upload of each
 * artifact replaces the previous one. `run_results.json` also raises the
 * run's signal, so a failed pipeline notifies as it would with dbt Cloud.
 */
export const pushArtifact = defineRoute<DbtContext>({
  id: "push-artifact",
  method: "PUT",
  path: "/artifacts/:name",
  auth: { token: "pushToken" },
  maxBodyBytes: MAX_ARTIFACT_BYTES,
  timeoutMs: 120_000,
  handle: async ({ request, context, blobs, emit }) => {
    if (context.config.method !== "push")
      throw new RouteError(
        409,
        "This service is not set up to receive pushed artifacts",
      );
    const name = artifactName(request.params.name);
    let data: unknown;
    try {
      data = JSON.parse(request.text());
    } catch {
      throw new RouteError(422, `${name} is not valid JSON`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new RouteError(422, `${name} must be a JSON object`);

    await blobs.put(pushedArtifactKey(name), request.body);

    if (name === "run_results.json") {
      await archiveRun(blobs, data as Record<string, unknown>, request.body);
      const result = localRunResults(data as Record<string, unknown>);
      if (
        result.runId &&
        Array.isArray((data as { results?: unknown }).results)
      )
        emit(localRunSignal(result), result, { idempotencyKey: result.runId });
    }
    return routeJson({ name, size: request.body.byteLength }, 201);
  },
});

export const dbtRoutes = [pushArtifact];
