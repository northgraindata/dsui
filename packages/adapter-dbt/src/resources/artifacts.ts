import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import {
  artifactNames,
  readArtifact,
  readArtifactDetail,
  readArtifacts,
} from "../artifacts.js";
import type { DbtContext } from "../context.js";

function local(ctx: DbtContext) {
  if (ctx.config.method !== "local")
    throw new Error(
      "This resource is available for dbt Local connections only",
    );
  return ctx.config;
}

export const artifacts = defineResource({
  id: "artifacts",
  query: (_input: undefined, ctx: DbtContext) =>
    readArtifacts(local(ctx)).then((items) =>
      items.map(({ data: _data, ...item }) => item),
    ),
});

export const artifactDetail = defineResource({
  id: "artifact-detail",
  input: z.object({ artifactName: z.enum(artifactNames) }),
  query: ({ artifactName }, ctx: DbtContext) =>
    readArtifactDetail(local(ctx), artifactName),
});

export const models = defineResource({
  id: "models",
  query: async (_input: undefined, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "manifest.json");
    if (!artifact.data) return [];
    const nodes = artifact.data.nodes;
    if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) return [];
    return Object.values(nodes).flatMap((node) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return [];
      const value = node as Record<string, unknown>;
      if (value.resource_type !== "model" || typeof value.name !== "string")
        return [];
      const config = value.config;
      const configRecord =
        typeof config === "object" && config !== null && !Array.isArray(config)
          ? (config as Record<string, unknown>)
          : undefined;
      const dependsOn = value.depends_on;
      return [
        {
          uniqueId:
            typeof value.unique_id === "string" ? value.unique_id : value.name,
          name: value.name,
          package:
            typeof value.package_name === "string" ? value.package_name : "",
          database: typeof value.database === "string" ? value.database : "",
          schema: typeof value.schema === "string" ? value.schema : "",
          materialized:
            typeof configRecord?.materialized === "string"
              ? configRecord.materialized
              : "",
          description:
            typeof value.description === "string" ? value.description : "",
          dependsOn:
            dependsOn &&
            typeof dependsOn === "object" &&
            !Array.isArray(dependsOn)
              ? ((dependsOn as Record<string, unknown>).nodes ?? [])
              : [],
        },
      ];
    });
  },
});

const modelInput = z.object({ modelId: z.string().min(1) });

async function readModel(ctx: DbtContext, modelId: string) {
  const artifact = await readArtifact(local(ctx), "manifest.json");
  const nodes = artifact.data?.nodes;
  if (!nodes || typeof nodes !== "object" || Array.isArray(nodes))
    throw new Error("manifest.json does not contain model nodes");
  const node = (nodes as Record<string, unknown>)[modelId];
  if (!node || typeof node !== "object" || Array.isArray(node))
    throw new Error(`Model not found: ${modelId}`);
  const value = node as Record<string, unknown>;
  const columns = value.columns;
  const dependsOn = value.depends_on;
  const columnRecords =
    columns && typeof columns === "object" && !Array.isArray(columns)
      ? Object.entries(columns).map(([name, column]) => {
          const record =
            column && typeof column === "object" && !Array.isArray(column)
              ? (column as Record<string, unknown>)
              : {};
          return {
            name,
            description:
              typeof record.description === "string" ? record.description : "",
            dataType:
              typeof record.data_type === "string" ? record.data_type : "",
          };
        })
      : [];
  return {
    uniqueId: modelId,
    name: typeof value.name === "string" ? value.name : modelId,
    description: typeof value.description === "string" ? value.description : "",
    database: typeof value.database === "string" ? value.database : "",
    schema: typeof value.schema === "string" ? value.schema : "",
    alias: typeof value.alias === "string" ? value.alias : "",
    compiledCode:
      typeof value.compiled_code === "string" ? value.compiled_code : "",
    dependencies:
      dependsOn && typeof dependsOn === "object" && !Array.isArray(dependsOn)
        ? ((dependsOn as Record<string, unknown>).nodes ?? [])
        : [],
    columns: columnRecords,
  };
}

export const modelDetail = defineResource({
  id: "model-detail",
  input: modelInput,
  query: ({ modelId }, ctx: DbtContext) => readModel(ctx, modelId),
});

export const modelColumns = defineResource({
  id: "model-columns",
  input: modelInput,
  query: ({ modelId }, ctx: DbtContext) =>
    readModel(ctx, modelId).then((model) => model.columns),
});

export const runGraph = defineResource({
  id: "run-graph",
  input: z.object({ runId: z.string().min(1) }),
  query: async (_input, ctx: DbtContext) => {
    if (ctx.config.method !== "local") return [];
    const [manifest, results] = await Promise.all([
      readArtifact(ctx.config, "manifest.json"),
      readArtifact(ctx.config, "run_results.json"),
    ]);
    const nodes = manifest.data?.nodes;
    if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) return [];
    const resultRows = Array.isArray(results.data?.results)
      ? results.data.results
      : [];
    const states = new Map(
      resultRows.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        return typeof row.unique_id === "string" &&
          typeof row.status === "string"
          ? [[row.unique_id, row.status] as const]
          : [];
      }),
    );
    return Object.values(nodes).flatMap((node) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return [];
      const value = node as Record<string, unknown>;
      if (value.resource_type !== "model") return [];
      const dependsOn = value.depends_on;
      return [
        {
          graphId:
            typeof value.unique_id === "string" ? value.unique_id : value.name,
          name: typeof value.name === "string" ? value.name : "Unnamed model",
          detail: typeof value.schema === "string" ? value.schema : "",
          state:
            typeof value.unique_id === "string"
              ? (states.get(value.unique_id) ?? "not run")
              : "not run",
          upstreamGraphIds:
            dependsOn &&
            typeof dependsOn === "object" &&
            !Array.isArray(dependsOn)
              ? ((dependsOn as Record<string, unknown>).nodes ?? [])
              : [],
        },
      ];
    });
  },
});

export const modelLineage = defineResource({
  id: "model-lineage",
  input: modelInput,
  query: async ({ modelId }, ctx: DbtContext) => {
    const artifact = await readArtifact(local(ctx), "manifest.json");
    const nodes = artifact.data?.nodes;
    if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) return [];
    const records = nodes as Record<string, unknown>;
    const upstream = new Set<string>();
    const downstream = new Set<string>();
    const dependencies = (id: string) => {
      const value = records[id];
      if (!value || typeof value !== "object" || Array.isArray(value))
        return [];
      const dependsOn = (value as Record<string, unknown>).depends_on;
      if (
        !dependsOn ||
        typeof dependsOn !== "object" ||
        Array.isArray(dependsOn)
      )
        return [];
      const ids = (dependsOn as Record<string, unknown>).nodes;
      return Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string")
        : [];
    };
    const visitUpstream = (id: string) => {
      for (const dependency of dependencies(id)) {
        if (upstream.has(dependency)) continue;
        upstream.add(dependency);
        visitUpstream(dependency);
      }
    };
    visitUpstream(modelId);
    for (const [id, value] of Object.entries(records)) {
      if (
        id === modelId ||
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      )
        continue;
      if (
        dependencies(id).some(
          (dependency) => dependency === modelId || upstream.has(dependency),
        )
      ) {
        downstream.add(id);
      }
    }
    const included = new Set([modelId, ...upstream, ...downstream]);
    return Object.entries(records).flatMap(([id, node]) => {
      if (
        !included.has(id) ||
        !node ||
        typeof node !== "object" ||
        Array.isArray(node)
      )
        return [];
      const value = node as Record<string, unknown>;
      return [
        {
          graphId: id,
          name: typeof value.name === "string" ? value.name : id,
          detail: typeof value.schema === "string" ? value.schema : "",
          state: id === modelId ? "selected" : "idle",
          upstreamGraphIds: dependencies(id),
        },
      ];
    });
  },
});
