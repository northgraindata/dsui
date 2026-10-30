import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type BlobStore,
  type ResourceRuntimeContext,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext, DbtLocalConfig } from "./context.js";

export const artifactNames = [
  "manifest.json",
  "catalog.json",
  "run_results.json",
  "sources.json",
  "freshness.json",
  "semantic_manifest.json",
  "osi_document.json",
  "graph_summary.json",
] as const;
export type ArtifactName = (typeof artifactNames)[number];

const jsonObject = z.record(z.unknown());

export type ArtifactRead = {
  readonly name: ArtifactName;
  readonly path: string;
  readonly present: boolean;
  readonly schemaVersion?: string;
  readonly data?: Record<string, unknown>;
  readonly warning?: string;
};

export type ArtifactDetail = ArtifactRead & {
  readonly content?: string;
};

/** Where artifacts the adapter reads were put: a project on disk, or uploaded by CI. */
export type ArtifactSource =
  | DbtLocalConfig
  | { readonly method: "push"; readonly blobs: BlobStore };

/** Blob key of the latest upload of one artifact. */
export const pushedArtifactKey = (name: ArtifactName): string =>
  `artifacts/${name}`;

/**
 * The artifact source a resource reads from.
 *
 * dbt Cloud has no artifacts to read here: its resources talk to the API.
 */
export function artifactSource(
  ctx: DbtContext & ResourceRuntimeContext,
): ArtifactSource {
  if (ctx.config.method === "local") return ctx.config;
  if (ctx.config.method === "push") return { method: "push", blobs: ctx.blobs };
  throw new Error("This resource is available for dbt Core connections only");
}

function targetDirectory(config: DbtLocalConfig): string {
  return join(config.projectPath, config.targetPath ?? "target");
}

function schemaVersionOf(data: Record<string, unknown>): string | undefined {
  const metadata = jsonObject.safeParse(data.metadata);
  return metadata.success &&
    typeof metadata.data.dbt_schema_version === "string"
    ? metadata.data.dbt_schema_version
    : undefined;
}

async function readText(
  source: ArtifactSource,
  name: ArtifactName,
): Promise<{ path: string; text: string } | undefined> {
  if (source.method === "push") {
    const key = pushedArtifactKey(name);
    const bytes = await source.blobs.get(key);
    return bytes
      ? { path: `pushed:${name}`, text: new TextDecoder().decode(bytes) }
      : undefined;
  }
  const path = join(targetDirectory(source), name);
  try {
    return { path, text: await readFile(path, "utf8") };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return undefined;
    throw error;
  }
}

export async function readArtifact(
  source: ArtifactSource,
  name: ArtifactName,
): Promise<ArtifactRead> {
  const location =
    source.method === "push"
      ? `pushed:${name}`
      : join(targetDirectory(source), name);
  try {
    const found = await readText(source, name);
    if (!found) return { name, path: location, present: false };
    const data = jsonObject.parse(JSON.parse(found.text));
    return {
      name,
      path: found.path,
      present: true,
      schemaVersion: schemaVersionOf(data),
      data,
    };
  } catch (error) {
    return {
      name,
      path: location,
      present: true,
      warning: error instanceof Error ? error.message : "Invalid JSON artifact",
    };
  }
}

export async function readArtifactDetail(
  source: ArtifactSource,
  name: ArtifactName,
): Promise<ArtifactDetail> {
  const artifact = await readArtifact(source, name);
  if (!artifact.present || artifact.warning) return artifact;
  return {
    ...artifact,
    content: JSON.stringify(artifact.data, null, 2),
  };
}

export async function readArtifacts(
  source: ArtifactSource,
): Promise<ArtifactRead[]> {
  return Promise.all(artifactNames.map((name) => readArtifact(source, name)));
}

export async function readLocalRunLog(
  config: DbtLocalConfig,
): Promise<string | undefined> {
  const paths = [
    join(targetDirectory(config), "dsui-last-run.log"),
    join(config.projectPath, "logs", "dbt.log"),
  ];
  for (const path of paths) {
    try {
      return (await readFile(path, "utf8")).slice(-2 * 1024 * 1024);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
    }
  }
  return undefined;
}
