import { z } from "@northgraindata/dsui-adapter-sdk";

export const DBT_ARTIFACT_KINDS = [
  "manifest",
  "catalog",
  "run_results",
  "sources",
] as const;
export type DbtArtifactKind = (typeof DBT_ARTIFACT_KINDS)[number];

export type DbtArtifactInput = string | Uint8Array;
export interface DbtArtifactReadOptions {
  readonly maxBytes?: number;
}

export interface DbtArtifactMetadata {
  readonly dbtVersion?: string;
  readonly generatedAt?: string;
  readonly invocationId?: string;
  readonly projectId?: string;
}

export interface DbtArtifactDetection {
  readonly kind: DbtArtifactKind;
  readonly version: number;
  readonly versionString: string;
  readonly compatibility: "dbt-v1" | "fusion-v2";
}

export interface DbtArtifactResult<T> {
  readonly detection: DbtArtifactDetection;
  readonly metadata: DbtArtifactMetadata;
  readonly summary: T;
  readonly warnings: readonly string[];
}

export interface DbtNodeSummary {
  readonly uniqueId: string;
  readonly resourceType: string;
  readonly name?: string;
  readonly packageName?: string;
  readonly path?: string;
  readonly dependsOn: readonly string[];
}

export interface DbtManifestSummary {
  readonly nodeCount: number;
  readonly nodes: readonly DbtNodeSummary[];
  readonly resourceCounts: Readonly<Record<string, number>>;
}

export interface DbtCatalogEntrySummary {
  readonly uniqueId: string;
  readonly name?: string;
  readonly type?: string;
  readonly columnCount: number;
}

export interface DbtCatalogSummary {
  readonly nodeCount: number;
  readonly sourceCount: number;
  readonly nodes: readonly DbtCatalogEntrySummary[];
  readonly sources: readonly DbtCatalogEntrySummary[];
}

export interface DbtRunResultSummary {
  readonly resultCount: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly results: readonly {
    readonly uniqueId: string;
    readonly status: string;
    readonly executionTime?: number;
    readonly message?: string;
  }[];
}

export interface DbtSourceResultSummary {
  readonly resultCount: number;
  readonly results: readonly {
    readonly uniqueId: string;
    readonly status?: string;
    readonly maxLoadedAt?: string;
    readonly snapshottedAt?: string;
  }[];
}

const metadataSchema = z
  .object({
    dbt_schema_version: z.string().min(1).optional(),
    dbt_version: z.string().min(1).optional(),
    generated_at: z.string().min(1).optional(),
    invocation_id: z.string().min(1).optional(),
    project_id: z.string().min(1).optional(),
  })
  .passthrough();
const baseSchema = z.object({ metadata: metadataSchema }).passthrough();
const nodeSchema = z
  .object({
    resource_type: z.string().min(1),
    name: z.string().min(1).optional(),
    package_name: z.string().min(1).optional(),
    original_file_path: z.string().min(1).optional(),
    depends_on: z
      .object({ nodes: z.array(z.string().min(1)).optional() })
      .optional(),
  })
  .passthrough();
const manifestSchema = baseSchema.extend({ nodes: z.record(nodeSchema) });
const catalogEntrySchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    columns: z.record(z.unknown()).optional(),
  })
  .passthrough();
const catalogSchema = baseSchema.extend({
  nodes: z.record(catalogEntrySchema).optional(),
  sources: z.record(catalogEntrySchema).optional(),
});
const runResultSchema = z
  .object({
    unique_id: z.string().min(1),
    status: z.string().min(1),
    execution_time: z.number().finite().optional(),
    message: z.string().optional(),
  })
  .passthrough();
const runResultsSchema = baseSchema.extend({
  results: z.array(runResultSchema),
});
const sourceResultSchema = z
  .object({
    unique_id: z.string().min(1),
    status: z.string().min(1).optional(),
    max_loaded_at: z.string().min(1).optional(),
    snapshotted_at: z.string().min(1).optional(),
  })
  .passthrough();
const sourcesSchema = baseSchema.extend({
  results: z.array(sourceResultSchema),
});

const supportedVersions: Record<DbtArtifactKind, readonly number[]> = {
  manifest: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  catalog: [1, 2, 3, 4, 5],
  run_results: [2, 3, 4, 5, 6],
  sources: [1, 2, 3],
};
const schemaPattern =
  /^https:\/\/schemas\.getdbt\.com\/dbt\/(manifest|catalog|run-results|sources)\/v(\d+)\.json$/;

export class DbtArtifactError extends Error {
  constructor(
    message: string,
    readonly code:
      | "malformed"
      | "oversized"
      | "missing-version"
      | "unsupported-version"
      | "invalid-structure",
  ) {
    super(message);
    this.name = "DbtArtifactError";
  }
}

function decodeInput(
  input: DbtArtifactInput,
  options: DbtArtifactReadOptions,
): unknown {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  if (!Number.isInteger(maxBytes) || maxBytes < 1)
    throw new RangeError("maxBytes must be a positive integer");
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  if (bytes.byteLength > maxBytes)
    throw new DbtArtifactError(
      `dbt artifact exceeds ${maxBytes} byte limit`,
      "oversized",
    );
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new DbtArtifactError(
      "dbt artifact is not valid UTF-8 JSON",
      "malformed",
    );
  }
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeMetadata(
  metadata: z.output<typeof metadataSchema>,
): DbtArtifactMetadata {
  return {
    ...(metadata.dbt_version ? { dbtVersion: metadata.dbt_version } : {}),
    ...(metadata.generated_at ? { generatedAt: metadata.generated_at } : {}),
    ...(metadata.invocation_id ? { invocationId: metadata.invocation_id } : {}),
    ...(metadata.project_id ? { projectId: metadata.project_id } : {}),
  };
}

export function detectDbtArtifact(
  value: unknown,
  options: DbtArtifactReadOptions = {},
): DbtArtifactDetection {
  if (typeof value === "string" || value instanceof Uint8Array)
    return detectDbtArtifact(decodeInput(value, options));
  const root = objectValue(value);
  const metadata = objectValue(root?.metadata);
  if (!metadata)
    throw new DbtArtifactError(
      "dbt artifact is missing metadata.dbt_schema_version",
      "missing-version",
    );
  const versionString =
    typeof metadata?.dbt_schema_version === "string"
      ? metadata.dbt_schema_version
      : undefined;
  if (!versionString)
    throw new DbtArtifactError(
      "dbt artifact is missing metadata.dbt_schema_version",
      "missing-version",
    );
  const match = schemaPattern.exec(versionString);
  if (!match)
    throw new DbtArtifactError(
      `unsupported dbt artifact schema version: ${versionString}`,
      "unsupported-version",
    );
  const kind = (
    match[1] === "run-results" ? "run_results" : match[1]
  ) as DbtArtifactKind;
  const version = Number(match[2]);
  if (!supportedVersions[kind].includes(version))
    throw new DbtArtifactError(
      `unsupported ${kind} schema version: ${versionString}`,
      "unsupported-version",
    );
  const dbtVersion =
    typeof metadata.dbt_version === "string" ? metadata.dbt_version : "";
  return {
    kind,
    version,
    versionString,
    compatibility: /^2\./.test(dbtVersion) ? "fusion-v2" : "dbt-v1",
  };
}

type ArtifactWithMetadata = { metadata: z.output<typeof metadataSchema> };
function read<T extends ArtifactWithMetadata, S>(
  kind: DbtArtifactKind,
  input: DbtArtifactInput,
  options: DbtArtifactReadOptions,
  schema: z.ZodType<T>,
  summarize: (value: T) => { summary: S; warnings: string[] },
): DbtArtifactResult<S> {
  const raw = decodeInput(input, options);
  const detection = detectDbtArtifact(raw);
  if (detection.kind !== kind)
    throw new DbtArtifactError(
      `expected ${kind}.json, received ${detection.kind}.json`,
      "invalid-structure",
    );
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new DbtArtifactError(
      `invalid ${kind}.json structure: ${parsed.error.issues[0]?.message ?? "validation failed"}`,
      "invalid-structure",
    );
  const metadata = parsed.data.metadata;
  const normalizedMetadata = normalizeMetadata(metadata);
  const output = summarize(parsed.data);
  return {
    detection,
    metadata: normalizedMetadata,
    summary: output.summary,
    warnings: output.warnings,
  };
}

function warnings(metadata: DbtArtifactMetadata, optional: string[]): string[] {
  return optional
    .filter((field) => !(field in metadata))
    .map((field) => `optional field missing: ${field}`);
}

export function readManifest(
  input: DbtArtifactInput,
  options: DbtArtifactReadOptions = {},
): DbtArtifactResult<DbtManifestSummary> {
  return read("manifest", input, options, manifestSchema, (value) => {
    const nodes = Object.entries(value.nodes).map(([uniqueId, node]) => ({
      uniqueId,
      resourceType: node.resource_type,
      ...(node.name ? { name: node.name } : {}),
      ...(node.package_name ? { packageName: node.package_name } : {}),
      ...(node.original_file_path ? { path: node.original_file_path } : {}),
      dependsOn: node.depends_on?.nodes ?? [],
    }));
    const resourceCounts: Record<string, number> = {};
    for (const node of nodes)
      resourceCounts[node.resourceType] =
        (resourceCounts[node.resourceType] ?? 0) + 1;
    const metadata = normalizeMetadata(value.metadata);
    return {
      summary: { nodeCount: nodes.length, nodes, resourceCounts },
      warnings: warnings(metadata, ["dbtVersion", "generatedAt"]),
    };
  }) as DbtArtifactResult<DbtManifestSummary>;
}

function catalogEntries(
  entries: Record<string, z.output<typeof catalogEntrySchema>>,
): DbtCatalogEntrySummary[] {
  return Object.entries(entries).map(([uniqueId, entry]) => ({
    uniqueId,
    ...(entry.name ? { name: entry.name } : {}),
    ...(entry.type ? { type: entry.type } : {}),
    columnCount: Object.keys(entry.columns ?? {}).length,
  }));
}

export function readCatalog(
  input: DbtArtifactInput,
  options: DbtArtifactReadOptions = {},
): DbtArtifactResult<DbtCatalogSummary> {
  return read("catalog", input, options, catalogSchema, (value) => {
    const nodes = catalogEntries(value.nodes ?? {});
    const sources = catalogEntries(value.sources ?? {});
    return {
      summary: {
        nodeCount: nodes.length,
        sourceCount: sources.length,
        nodes,
        sources,
      },
      warnings: [
        ...(value.nodes ? [] : ["optional field missing: nodes"]),
        ...(value.sources ? [] : ["optional field missing: sources"]),
      ],
    };
  }) as DbtArtifactResult<DbtCatalogSummary>;
}

export function readRunResults(
  input: DbtArtifactInput,
  options: DbtArtifactReadOptions = {},
): DbtArtifactResult<DbtRunResultSummary> {
  return read("run_results", input, options, runResultsSchema, (value) => {
    const statusCounts: Record<string, number> = {};
    const results = value.results.map((result) => {
      statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
      return {
        uniqueId: result.unique_id,
        status: result.status,
        ...(result.execution_time === undefined
          ? {}
          : { executionTime: result.execution_time }),
        ...(result.message === undefined ? {} : { message: result.message }),
      };
    });
    return {
      summary: { resultCount: results.length, statusCounts, results },
      warnings: value.metadata.generated_at
        ? []
        : ["optional field missing: generatedAt"],
    };
  }) as DbtArtifactResult<DbtRunResultSummary>;
}

export function readSources(
  input: DbtArtifactInput,
  options: DbtArtifactReadOptions = {},
): DbtArtifactResult<DbtSourceResultSummary> {
  return read("sources", input, options, sourcesSchema, (value) => ({
    summary: {
      resultCount: value.results.length,
      results: value.results.map((result) => ({
        uniqueId: result.unique_id,
        ...(result.status ? { status: result.status } : {}),
        ...(result.max_loaded_at ? { maxLoadedAt: result.max_loaded_at } : {}),
        ...(result.snapshotted_at
          ? { snapshottedAt: result.snapshotted_at }
          : {}),
      })),
    },
    warnings: value.metadata.generated_at
      ? []
      : ["optional field missing: generatedAt"],
  }));
}

export const readManifestArtifact = readManifest;
export const readCatalogArtifact = readCatalog;
export const readRunResultsArtifact = readRunResults;
export const readSourcesArtifact = readSources;
