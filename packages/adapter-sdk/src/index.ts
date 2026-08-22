import { createHash, timingSafeEqual } from "node:crypto";
import { CAPABILITY_KINDS, type AdapterMetadata, type CapabilityDeclaration, type FieldDescriptor, type HealthStatus } from "@dsui/core";
import { z } from "zod";

export { z };
export const ADAPTER_SDK_VERSION = "0.1.0";

export interface AdapterContext {
  signal?: AbortSignal;
  now?: () => Date;
  fetch?: typeof fetch;
  log?: { debug(message: string, fields?: Record<string, unknown>): void; warn(message: string, fields?: Record<string, unknown>): void };
}

export interface AdapterInstance {
  health(): Promise<HealthStatus>;
  execute(operationId: string, input: unknown): Promise<unknown>;
  close?(): Promise<void> | void;
}

export interface AdapterDefinition<TConnection extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  version: string;
  sdkVersion: string;
  metadata: AdapterMetadata;
  connectionSchema: TConnection;
  connectionFields: readonly FieldDescriptor[];
  /** Dot paths that must be redacted in logs and API responses. */
  secretPaths: readonly string[];
  capabilities: readonly CapabilityDeclaration[];
  create(context: AdapterContext, connection: z.output<TConnection>): AdapterInstance;
}

export function defineAdapter<T extends z.ZodTypeAny>(definition: AdapterDefinition<T>): AdapterDefinition<T> {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) throw new Error("Adapter id must be kebab-case");
  if (definition.sdkVersion !== ADAPTER_SDK_VERSION) throw new Error(`Adapter ${definition.id} targets incompatible SDK ${definition.sdkVersion}`);
  const operationIds = new Set<string>();
  for (const capability of definition.capabilities) {
    if (operationIds.has(capability.id)) throw new Error(`Duplicate capability ${capability.id}`);
    operationIds.add(capability.id);
  }
  return definition;
}

export const adapterManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  sdkVersion: z.string().min(1),
  entry: z.string().regex(/^\.\/dist\/[A-Za-z0-9._/-]+\.mjs$/),
  license: z.string().min(1),
  repository: z.string().url(),
  capabilities: z.array(z.string()).min(1),
  bundle: z.object({ bytes: z.number().int().positive().max(5 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  sbom: z.string().regex(/^\.\/[A-Za-z0-9._/-]+\.json$/).optional(),
});
export type AdapterManifest = z.infer<typeof adapterManifestSchema>;

const exactVersion = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "must be an exact SemVer version");
export const npmAdapterSourceSchema = z.object({
  source: z.literal("npm"),
  package: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: exactVersion,
  integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/),
  entry: z.string().regex(/^\.\/dist\/[A-Za-z0-9._/-]+\.mjs$/).optional(),
});
/** GitHub is an identity hint for an npm package, never a clone/install source. */
export const githubAdapterSourceSchema = z.object({
  source: z.literal("github"),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  package: z.string().regex(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/),
  version: exactVersion,
  integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/),
});
export const externalAdapterSourceSchema = z.discriminatedUnion("source", [npmAdapterSourceSchema, githubAdapterSourceSchema]);
export type ExternalAdapterSource = z.infer<typeof externalAdapterSourceSchema>;

export function validateExternalSource(value: unknown): ExternalAdapterSource {
  const source = externalAdapterSourceSchema.parse(value);
  // `github` remains npm-backed; direct git URLs and floating refs are deliberately unavailable.
  return source;
}

export interface ArchiveEntry { path: string; size: number; type: "file" | "directory" | "symlink" | "other"; }
export function validateArchiveEntries(entries: readonly ArchiveEntry[], maxBytes = 10 * 1024 * 1024): void {
  let bytes = 0;
  for (const entry of entries) {
    if (entry.type === "symlink" || entry.type === "other") throw new Error(`Unsafe adapter archive entry: ${entry.path}`);
    if (entry.path.startsWith("/") || entry.path.split("/").includes("..")) throw new Error(`Path traversal in adapter archive: ${entry.path}`);
    if (entry.type === "file") bytes += entry.size;
  }
  if (bytes > maxBytes) throw new Error(`Adapter archive exceeds ${maxBytes} byte limit`);
}

export function verifySriSha512(bytes: Uint8Array, integrity: string): boolean {
  const expected = integrity.slice("sha512-".length);
  const actual = createHash("sha512").update(bytes).digest("base64");
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function validateManifest(manifest: unknown, expected: Pick<ExternalAdapterSource, "version"> & { entry?: string }): AdapterManifest {
  const parsed = adapterManifestSchema.parse(manifest);
  if (parsed.version !== expected.version) throw new Error("Adapter manifest version differs from configured version");
  if (expected.entry && parsed.entry !== expected.entry) throw new Error("Adapter manifest entry differs from configured entry");
  for (const capability of parsed.capabilities) if (!CAPABILITY_KINDS.includes(capability as (typeof CAPABILITY_KINDS)[number])) throw new Error(`Unsupported capability renderer: ${capability}`);
  return parsed;
}
