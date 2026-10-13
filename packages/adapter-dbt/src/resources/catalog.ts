import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import { readArtifact } from "../artifacts.js";
import type { DbtContext } from "../context.js";

function local(ctx: DbtContext) {
  if (ctx.config.method !== "local")
    throw new Error(
      "This resource is available for dbt Local connections only",
    );
  return ctx.config;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value).flatMap((item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? [item as Record<string, unknown>]
      : [],
  );
}

export const sources = defineResource({
  id: "sources",
  query: async (_input: undefined, ctx: DbtContext) => {
    const config = local(ctx);
    const [manifest, freshness] = await Promise.all([
      readArtifact(config, "manifest.json"),
      readArtifact(config, "sources.json"),
    ]);
    const freshnessById = new Map(
      records(freshness.data?.results).map((item) => [item.unique_id, item]),
    );
    return records(manifest.data?.sources).map((source) => {
      const uniqueId =
        typeof source.unique_id === "string" ? source.unique_id : "";
      const fresh = freshnessById.get(uniqueId);
      return {
        uniqueId,
        name: typeof source.name === "string" ? source.name : uniqueId,
        sourceName:
          typeof source.source_name === "string" ? source.source_name : "",
        identifier:
          typeof source.identifier === "string" ? source.identifier : "",
        database: typeof source.database === "string" ? source.database : "",
        schema: typeof source.schema === "string" ? source.schema : "",
        status: typeof fresh?.status === "string" ? fresh.status : "unknown",
        maxLoadedAt:
          typeof fresh?.max_loaded_at === "string" ? fresh.max_loaded_at : "",
        error: typeof fresh?.error === "string" ? fresh.error : "",
      };
    });
  },
});

export const tests = defineResource({
  id: "tests",
  query: async (_input: undefined, ctx: DbtContext) => {
    const config = local(ctx);
    const [manifest, results] = await Promise.all([
      readArtifact(config, "manifest.json"),
      readArtifact(config, "run_results.json"),
    ]);
    const resultById = new Map(
      records(results.data?.results).map((item) => [item.unique_id, item]),
    );
    return records(manifest.data?.nodes).flatMap((test) => {
      if (test.resource_type !== "test") return [];
      const uniqueId = typeof test.unique_id === "string" ? test.unique_id : "";
      const result = resultById.get(uniqueId);
      return [
        {
          uniqueId,
          name: typeof test.name === "string" ? test.name : uniqueId,
          attachedTo:
            typeof test.attached_node === "string" ? test.attached_node : "",
          status:
            typeof result?.status === "string" ? result.status : "not run",
          message: typeof result?.message === "string" ? result.message : "",
        },
      ];
    });
  },
});
