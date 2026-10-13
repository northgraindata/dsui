import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import { readArtifact } from "../artifacts.js";
import type { DbtContext } from "../context.js";

function local(ctx: DbtContext) {
  if (ctx.config.method !== "local")
    throw new Error(
      "This resource is available for dbt Local connections only",
    );
  return ctx.config;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value).flatMap((item) => {
    const value = record(item);
    return value ? [value] : [];
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function artifactMetadata(data: Record<string, unknown> | undefined) {
  const metadata = record(data?.metadata);
  return {
    schemaVersion: stringValue(metadata?.dbt_schema_version),
    dbtVersion: stringValue(metadata?.dbt_version),
    generatedAt: stringValue(metadata?.generated_at),
    invocationId: stringValue(metadata?.invocation_id),
    adapterType: stringValue(metadata?.adapter_type),
    projectName: stringValue(metadata?.project_name),
  };
}

export const manifestOverview = defineResource({
  id: "manifest-overview",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "manifest.json");
    const metadata = artifactMetadata(artifact.data);
    return {
      ...metadata,
      models: records(artifact.data?.nodes).filter(
        (node) => node.resource_type === "model",
      ).length,
      tests: records(artifact.data?.nodes).filter(
        (node) => node.resource_type === "test",
      ).length,
      seeds: records(artifact.data?.nodes).filter(
        (node) => node.resource_type === "seed",
      ).length,
      snapshots: records(artifact.data?.nodes).filter(
        (node) => node.resource_type === "snapshot",
      ).length,
      sources: records(artifact.data?.sources).length,
      macros: records(artifact.data?.macros).length,
      exposures: records(artifact.data?.exposures).length,
    };
  },
});

export const semanticOverview = defineResource({
  id: "semantic-overview",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "semantic_manifest.json");
    return {
      ...artifactMetadata(artifact.data),
      semanticModels: arrayLength(artifact.data?.semantic_models),
      metrics: arrayLength(artifact.data?.metrics),
      savedQueries: arrayLength(artifact.data?.saved_queries),
      timeSpines: arrayLength(
        record(artifact.data?.project_configuration)?.time_spines,
      ),
    };
  },
});

export const semanticModels = defineResource({
  id: "semantic-models",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "semantic_manifest.json");
    const models = Array.isArray(artifact.data?.semantic_models)
      ? artifact.data.semantic_models
      : [];
    return models.flatMap((item) => {
      const model = record(item);
      if (!model) return [];
      const relation = record(model.node_relation);
      return [
        {
          name: stringValue(model.name),
          description: stringValue(model.description),
          relation: stringValue(relation?.relation_name),
          entities: arrayLength(model.entities),
          measures: arrayLength(model.measures),
          dimensions: arrayLength(model.dimensions),
        },
      ];
    });
  },
});

export const semanticMetrics = defineResource({
  id: "semantic-metrics",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "semantic_manifest.json");
    const metrics = Array.isArray(artifact.data?.metrics)
      ? artifact.data.metrics
      : [];
    return metrics.flatMap((item) => {
      const metric = record(item);
      if (!metric) return [];
      const typeParams = record(metric.type_params);
      const measure = record(typeParams?.measure);
      return [
        {
          name: stringValue(metric.name),
          type: stringValue(metric.type),
          description: stringValue(metric.description),
          measure: stringValue(measure?.name),
        },
      ];
    });
  },
});

export const semanticSavedQueries = defineResource({
  id: "semantic-saved-queries",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "semantic_manifest.json");
    const queries = Array.isArray(artifact.data?.saved_queries)
      ? artifact.data.saved_queries
      : [];
    return queries.flatMap((item) => {
      const query = record(item);
      if (!query) return [];
      const params = record(query.query_params);
      return [
        {
          name: stringValue(query.name),
          label: stringValue(query.label),
          description: stringValue(query.description),
          metrics: Array.isArray(params?.metrics)
            ? params.metrics
                .filter(
                  (metric): metric is string => typeof metric === "string",
                )
                .join(", ")
            : "",
        },
      ];
    });
  },
});

export const catalogRelations = defineResource({
  id: "catalog-relations",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "catalog.json");
    return records(artifact.data?.nodes).map((node) => ({
      uniqueId: stringValue(node.unique_id),
      name: stringValue(node.name) || stringValue(node.unique_id),
      type: stringValue(node.resource_type),
      database: stringValue(node.database),
      schema: stringValue(node.schema),
      relation: stringValue(node.relation_name),
      columns: record(node.columns)
        ? Object.keys(node.columns as object).length
        : 0,
      bytes: typeof node.bytes === "number" ? node.bytes : 0,
    }));
  },
});

export const freshnessRows = defineResource({
  id: "freshness-rows",
  query: async (_input: undefined, ctx: DbtContext) => {
    const config = local(ctx);
    const freshness = await readArtifact(config, "freshness.json");
    const fallback = await readArtifact(config, "sources.json");
    const data = freshness.present ? freshness.data : fallback.data;
    return records(data?.results).map((row) => ({
      uniqueId: stringValue(row.unique_id),
      status: stringValue(row.status) || "unknown",
      maxLoadedAt: stringValue(row.max_loaded_at),
      snapshottedAt: stringValue(row.snapshotted_at),
      error: stringValue(row.error),
    }));
  },
});

export const graphSummaryRows = defineResource({
  id: "graph-summary-rows",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "graph_summary.json");
    return records(artifact.data?.linked).map((row) => ({
      id: stringValue(row.name),
      name: stringValue(row.name),
      type: stringValue(row.type),
      successors: arrayLength(row.succ),
    }));
  },
});

export const osiOverview = defineResource({
  id: "osi-overview",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "osi_document.json");
    return {
      ...artifactMetadata(artifact.data),
      sections: artifact.data ? Object.keys(artifact.data).join(", ") : "",
      semanticModels: arrayLength(artifact.data?.semantic_models),
      metrics: arrayLength(artifact.data?.metrics),
      savedQueries: arrayLength(artifact.data?.saved_queries),
    };
  },
});

export const runResultsOverview = defineResource({
  id: "run-results-overview",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "run_results.json");
    const results = Array.isArray(artifact.data?.results)
      ? artifact.data.results
      : [];
    const statuses = results.flatMap((item) => {
      const row = record(item);
      return typeof row?.status === "string" ? [row.status] : [];
    });
    return {
      ...artifactMetadata(artifact.data),
      total: results.length,
      success: statuses.filter((status) => status === "success").length,
      error: statuses.filter((status) => ["error", "fail"].includes(status))
        .length,
      skipped: statuses.filter((status) => status === "skipped").length,
      duration: results.reduce(
        (total, item) =>
          total +
          (typeof record(item)?.execution_time === "number"
            ? (record(item)?.execution_time as number)
            : 0),
        0,
      ),
    };
  },
});

export const runResultRows = defineResource({
  id: "run-result-rows",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "run_results.json");
    const results = Array.isArray(artifact.data?.results)
      ? artifact.data.results
      : [];
    return results.flatMap((item) => {
      const row = record(item);
      if (!row) return [];
      return [
        {
          uniqueId: stringValue(row.unique_id),
          status: stringValue(row.status),
          duration:
            typeof row.execution_time === "number"
              ? `${row.execution_time.toFixed(2)}s`
              : "",
          message: stringValue(row.message),
          failures: typeof row.failures === "number" ? row.failures : 0,
        },
      ];
    });
  },
});

export const explorerInput = z.object({ artifactName: z.string().min(1) });
