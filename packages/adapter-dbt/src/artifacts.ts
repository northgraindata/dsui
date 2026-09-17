import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type { DbtLocalConfig } from "./context.js";

export const artifactNames = [
  "manifest.json",
  "catalog.json",
  "run_results.json",
  "sources.json",
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

function targetDirectory(config: DbtLocalConfig): string {
  return join(config.projectPath, config.targetPath ?? "target");
}

export async function readArtifact(
  config: DbtLocalConfig,
  name: ArtifactName,
): Promise<ArtifactRead> {
  const path = join(targetDirectory(config), name);
  try {
    const data = jsonObject.parse(JSON.parse(await readFile(path, "utf8")));
    const metadata = jsonObject.safeParse(data.metadata);
    const schemaVersion = metadata.success
      ? typeof metadata.data.dbt_schema_version === "string"
        ? metadata.data.dbt_schema_version
        : undefined
      : undefined;
    return { name, path, present: true, schemaVersion, data };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return { name, path, present: false };
    return {
      name,
      path,
      present: true,
      warning: error instanceof Error ? error.message : "Invalid JSON artifact",
    };
  }
}

export async function readArtifactDetail(
  config: DbtLocalConfig,
  name: ArtifactName,
): Promise<ArtifactDetail> {
  const artifact = await readArtifact(config, name);
  if (!artifact.present || artifact.warning) return artifact;
  return {
    ...artifact,
    content: JSON.stringify(artifact.data, null, 2),
  };
}

export async function readArtifacts(
  config: DbtLocalConfig,
): Promise<ArtifactRead[]> {
  return Promise.all(artifactNames.map((name) => readArtifact(config, name)));
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
