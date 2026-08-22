/**
 * Community adapters are fetched as already-built, content-addressed bundles.
 * This module deliberately does not run npm, git, package-manager hooks, or a
 * build command.  Running an adapter still executes third-party JavaScript;
 * callers must use an OS/container boundary if they need a security sandbox.
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { ADAPTER_SDK_VERSION, adapterManifestSchema, type AdapterContext, type AdapterDefinition, verifySriSha512 } from "@dsui/adapter-sdk";
import type { HealthStatus } from "@dsui/core";
import { CAPABILITY_KINDS, type CapabilityKind } from "@dsui/core";
import { z } from "zod";

const MAX_PACKUMENT_BYTES = 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 10 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const SRI = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/;
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const gitRepository = /^git\+https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/;
const commitSha = /^[a-f0-9]{40}$/;

export class ExternalAdapterError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ExternalAdapterError";
  }
}

/** Local production schema: direct GitHub sources are immutable raw files. */
export const communityAdapterSourceSchema = z.union([
  z.object({
    source: z.literal("npm"),
    package: z.string().regex(packageName, "must be a lowercase npm package name"),
    version: z.string().regex(exactVersion, "must be an exact SemVer version"),
    integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/, "must be a SHA-512 tarball SRI digest"),
    entry: z.string().regex(/^\.\/dist\/[A-Za-z0-9._/-]+\.mjs$/).optional(),
  }).strict(),
  z.object({
    source: z.literal("git"),
    repository: z.string().regex(gitRepository, "must be a git+https://github.com/owner/repository URL"),
    commit: z.string().regex(commitSha, "must be a full lowercase commit SHA"),
    /** SRI for the one committed adapter bundle. `integrity` is accepted for concise YAML. */
    integrity: z.string().regex(SRI, "must be an SRI digest").optional(),
    bundleIntegrity: z.string().regex(SRI, "must be an SRI digest").optional(),
    entry: z.string().regex(/^\.\/dist\/[A-Za-z0-9._/-]+\.mjs$/).optional(),
  }).strict().refine((value) => Boolean(value.integrity) !== Boolean(value.bundleIntegrity), "provide exactly one of integrity or bundleIntegrity").transform(({ bundleIntegrity, ...value }) => ({ ...value, integrity: value.integrity ?? bundleIntegrity! })),
]);
export type CommunityAdapterSource = z.infer<typeof communityAdapterSourceSchema>;

export interface AdapterFetch {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface ExternalAdapterManagerOptions {
  /** Persisted cache and activation metadata. Defaults to /data. */
  dataDir?: string;
  fetch?: AdapterFetch;
  /** Never opens the network; an existing verified activation is required. */
  offline?: boolean;
}

export interface InstalledExternalAdapter {
  id: string;
  source: CommunityAdapterSource;
  manifest: z.infer<typeof adapterManifestSchema>;
  manifestPath: string;
  bundlePath: string;
  bundleSha256: string;
  installedAt: string;
}

type Activation = Omit<InstalledExternalAdapter, "manifest" | "source"> & {
  source: CommunityAdapterSource;
  manifestSha256: string;
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function equalSri(bytes: Uint8Array, integrity: string): boolean {
  const [algorithm, encoded] = integrity.split("-", 2);
  if (!algorithm || !encoded) return false;
  const actual = createHash(algorithm).update(bytes).digest("base64");
  return actual.length === encoded.length && timingSafeEqual(Buffer.from(actual), Buffer.from(encoded));
}

function isSafeRelativePath(path: string): boolean {
  return path.length > 0 && !path.includes("\\") && !path.startsWith("/") && !path.split("/").includes("..");
}

function bundlePathFromManifest(manifest: z.infer<typeof adapterManifestSchema>): string {
  const path = manifest.entry.slice(2);
  if (path !== "dist/adapter.mjs") throw new ExternalAdapterError("Community adapters must provide one bundled dist/adapter.mjs entry");
  return path;
}

/** Allows only the two fixed public HTTPS endpoints used by this resolver. */
export function assertSafeAdapterUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new ExternalAdapterError("Invalid adapter download URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash)
    throw new ExternalAdapterError("Adapter downloads require credential-free HTTPS");
  const allowed = url.hostname === "registry.npmjs.org" || url.hostname === "raw.githubusercontent.com";
  if (!allowed) throw new ExternalAdapterError("Adapter download host is not allowlisted");
  return url;
}

async function readResponse(response: Response, limit: number, label: string): Promise<Uint8Array> {
  if (!response.ok) throw new ExternalAdapterError(`${label} request failed (${response.status})`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > limit) throw new ExternalAdapterError(`${label} exceeds size limit`);
  if (!response.body) throw new ExternalAdapterError(`${label} response has no body`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > limit) throw new ExternalAdapterError(`${label} exceeds size limit`);
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function fetchPublic(fetcher: AdapterFetch, value: string, limit: number, label: string): Promise<Uint8Array> {
  const url = assertSafeAdapterUrl(value);
  const response = await fetcher(url.toString(), { redirect: "error", headers: { accept: "application/json, application/octet-stream" } });
  return readResponse(response, limit, label);
}

async function fetchNpm(fetcher: AdapterFetch, value: string, limit: number, label: string): Promise<Uint8Array> {
  const url = assertSafeAdapterUrl(value);
  if (url.hostname !== "registry.npmjs.org") throw new ExternalAdapterError("npm artifacts must be served by registry.npmjs.org");
  const response = await fetcher(url.toString(), { redirect: "error", headers: { accept: "application/json, application/octet-stream" } });
  return readResponse(response, limit, label);
}

function tarString(block: Uint8Array, start: number, length: number): string {
  const bytes = block.slice(start, start + length);
  const nul = bytes.indexOf(0);
  return new TextDecoder().decode(nul === -1 ? bytes : bytes.slice(0, nul));
}

function tarNumber(block: Uint8Array, start: number, length: number): number {
  const raw = tarString(block, start, length).trim();
  if (!/^[0-7]*$/.test(raw)) throw new ExternalAdapterError("Invalid tar archive size");
  return raw ? Number.parseInt(raw, 8) : 0;
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new ExternalAdapterError("Adapter archive is not a valid gzip tarball", error);
  }
}

/** Minimal, deliberately restrictive tar reader. It accepts regular files/dirs only. */
async function extractNpmFiles(archive: Uint8Array): Promise<Map<string, Uint8Array>> {
  if (archive.length > MAX_ARCHIVE_BYTES) throw new ExternalAdapterError("Adapter archive exceeds size limit");
  const tar = await gunzip(archive);
  if (tar.length > MAX_UNPACKED_BYTES + 1024 * 1024) throw new ExternalAdapterError("Adapter archive expands beyond size limit");
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  let total = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.slice(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const prefix = tarString(header, 345, 155);
    const name = `${prefix ? `${prefix}/` : ""}${tarString(header, 0, 100)}`;
    const type = String.fromCharCode(header[156] || 48);
    const size = tarNumber(header, 124, 12);
    if (!isSafeRelativePath(name) || !name.startsWith("package/")) throw new ExternalAdapterError("Adapter archive contains an unsafe path");
    if (type !== "0" && type !== "\0" && type !== "5") throw new ExternalAdapterError("Adapter archive contains links or special files");
    const dataStart = offset + 512;
    const padded = Math.ceil(size / 512) * 512;
    if (dataStart + padded > tar.length) throw new ExternalAdapterError("Truncated adapter tar archive");
    if (type !== "5") {
      total += size;
      if (total > MAX_UNPACKED_BYTES) throw new ExternalAdapterError("Adapter archive expands beyond size limit");
      const relative = name.slice("package/".length);
      if (!relative || files.has(relative)) throw new ExternalAdapterError("Adapter archive has duplicate or invalid files");
      files.set(relative, tar.slice(dataStart, dataStart + size));
    }
    offset = dataStart + padded;
  }
  return files;
}

function rejectUnsafeBundle(bundle: Uint8Array, entry: string): void {
  if (bundle.length > MAX_BUNDLE_BYTES) throw new ExternalAdapterError("Adapter bundle exceeds size limit");
  const source = new TextDecoder().decode(bundle);
  // A release bundle must not pull in another local chunk at runtime. This is
  // not a JavaScript security scanner; the subprocess remains unsandboxed.
  if (/\bimport\s*(?:\(|[^"']*["'](?:\.{1,2}\/|\/))/m.test(source) || /\bexport\s+[^;]*\s+from\s*["'](?:\.{1,2}\/|\/)/m.test(source))
    throw new ExternalAdapterError(`Adapter entry ${entry} is code-split or imports a local module`);
}

function validateFiles(manifestBytes: Uint8Array, bundle: Uint8Array, source: CommunityAdapterSource) {
  if (manifestBytes.length > MAX_MANIFEST_BYTES) throw new ExternalAdapterError("Adapter manifest exceeds size limit");
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(manifestBytes)); } catch { throw new ExternalAdapterError("Adapter manifest is not valid JSON"); }
  const manifest = adapterManifestSchema.parse(raw);
  if (manifest.sdkVersion !== ADAPTER_SDK_VERSION) throw new ExternalAdapterError(`Adapter targets SDK ${manifest.sdkVersion}; host requires ${ADAPTER_SDK_VERSION}`);
  for (const capability of manifest.capabilities)
    if (!CAPABILITY_KINDS.includes(capability as (typeof CAPABILITY_KINDS)[number]))
      throw new ExternalAdapterError(`Unsupported adapter capability: ${capability}`);
  if (source.source === "npm" && manifest.version !== source.version) throw new ExternalAdapterError("Adapter manifest version differs from configured version");
  if (source.entry && manifest.entry !== source.entry) throw new ExternalAdapterError("Adapter manifest entry differs from configured entry");
  const actual = sha256(bundle);
  if (actual !== manifest.bundle.sha256 || manifest.bundle.bytes !== bundle.length) throw new ExternalAdapterError("Adapter bundle differs from manifest digest or byte count");
  // npm integrity authenticates the tarball (checked before extraction); a git
  // source has no archive, so its configured SRI authenticates the raw bundle.
  if (source.source === "git" && !equalSri(bundle, source.integrity)) throw new ExternalAdapterError("Adapter bundle SRI differs from configured integrity");
  rejectUnsafeBundle(bundle, manifest.entry);
  return manifest;
}

function npmPackumentUrl(name: string): string { return `https://registry.npmjs.org/${encodeURIComponent(name)}`; }

function githubRawUrl(repository: string, commit: string, path: string): string {
  const match = gitRepository.exec(repository);
  if (!match) throw new ExternalAdapterError("Invalid GitHub repository URL");
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${commit}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export class ExternalAdapterManager {
  readonly dataDir: string;
  private readonly fetcher: AdapterFetch;
  private readonly offline: boolean;

  constructor(options: ExternalAdapterManagerOptions = {}) {
    this.dataDir = resolve(options.dataDir ?? "/data");
    this.fetcher = options.fetch ?? fetch;
    this.offline = options.offline ?? false;
  }

  /** One immutable source may exist per manifest id, so the file name is
   *  content-addressed by the source definition to keep multiple configured
   *  variants (e.g. an npm and a git pin of one adapter) from clobbering
   *  each other's activation record. */
  private activationPath(id: string): string { return join(this.dataDir, "adapters", `${id}.json`); }
  private activationKey(manifestId: string, source: CommunityAdapterSource): string {
    return `${manifestId}.${sha256(new TextEncoder().encode(JSON.stringify(source))).slice(0, 16)}`;
  }
  // The digest remains the address; the suffix lets Bun's ESM loader recognize
  // the verified executable as an ES module without consulting package.json.
  private objectPath(hash: string, suffix = ""): string { return join(this.dataDir, "objects", "sha256", `${hash}${suffix}`); }

  private async atomic(path: string, bytes: string | Uint8Array): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try { await writeFile(temporary, bytes); await rename(temporary, path); } finally { await rm(temporary, { force: true }); }
  }

  private async saveObject(bytes: Uint8Array, suffix: ".json" | ".mjs"): Promise<string> {
    const hash = sha256(bytes);
    const path = this.objectPath(hash, suffix);
    try { await readFile(path); } catch { await this.atomic(path, bytes); }
    return path;
  }

  private async cachedFor(source: CommunityAdapterSource): Promise<InstalledExternalAdapter | undefined> {
    let names: string[];
    try { names = await readdir(join(this.dataDir, "adapters")); } catch { return undefined; }
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const cached = await this.loadActivation(name);
      if (cached && JSON.stringify(cached.source) === JSON.stringify(source)) return cached;
    }
    return undefined;
  }

  /** Validated cache lookup by source; never opens the network. */
  installedFor(source: CommunityAdapterSource): Promise<InstalledExternalAdapter | undefined> {
    return this.cachedFor(source);
  }

  /** Review-only npm metadata lookup used by `dsui doctor --resolve-adapter`. */
  async npmIntegrity(name: string, version: string): Promise<{ tarball: string; integrity: string }> {
    if (!packageName.test(name)) throw new ExternalAdapterError("Invalid npm package name");
    if (!exactVersion.test(version)) throw new ExternalAdapterError("npm version must be an exact SemVer version");
    const packumentBytes = await fetchNpm(this.fetcher, npmPackumentUrl(name), MAX_PACKUMENT_BYTES, "npm packument");
    let packument: any;
    try { packument = JSON.parse(new TextDecoder().decode(packumentBytes)); } catch { throw new ExternalAdapterError("npm packument is not valid JSON"); }
    const dist = packument?.versions?.[version]?.dist;
    if (!dist || typeof dist.tarball !== "string" || typeof dist.integrity !== "string") throw new ExternalAdapterError("Exact npm adapter version is unavailable");
    return { tarball: dist.tarball, integrity: dist.integrity };
  }

  private async loadActivation(fileName: string): Promise<InstalledExternalAdapter | undefined> {
    let activation: Activation;
    try { activation = JSON.parse(await readFile(join(this.dataDir, "adapters", fileName), "utf8")); } catch { return undefined; }
    if (!activation || typeof activation.manifestSha256 !== "string" || typeof activation.bundleSha256 !== "string") return undefined;
    try {
      const source = communityAdapterSourceSchema.parse(activation.source);
      const manifestBytes = new Uint8Array(await readFile(this.objectPath(activation.manifestSha256, ".json")));
      const bundle = new Uint8Array(await readFile(this.objectPath(activation.bundleSha256, ".mjs")));
      if (sha256(manifestBytes) !== activation.manifestSha256 || sha256(bundle) !== activation.bundleSha256) throw new Error("hash mismatch");
      const manifest = validateFiles(manifestBytes, bundle, source);
      if (manifest.id !== activation.id) throw new Error("id mismatch");
      return { ...activation, source, manifest, manifestPath: this.objectPath(activation.manifestSha256, ".json"), bundlePath: this.objectPath(activation.bundleSha256, ".mjs") };
    } catch { return undefined; }
  }

  async get(id: string): Promise<InstalledExternalAdapter | undefined> {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new ExternalAdapterError("Invalid adapter id");
    return this.loadActivation(`${id}.json`);
  }

  async install(value: unknown): Promise<InstalledExternalAdapter> {
    const source = communityAdapterSourceSchema.parse(value);
    if (this.offline) {
      const cached = await this.cachedFor(source);
      if (cached) return cached;
      throw new ExternalAdapterError("Adapter is not available in the verified offline cache");
    }
    let manifestBytes: Uint8Array;
    let bundle: Uint8Array;
    if (source.source === "npm") {
      const packumentBytes = await fetchNpm(this.fetcher, npmPackumentUrl(source.package), MAX_PACKUMENT_BYTES, "npm packument");
      let packument: any;
      try { packument = JSON.parse(new TextDecoder().decode(packumentBytes)); } catch { throw new ExternalAdapterError("npm packument is not valid JSON"); }
      const dist = packument?.versions?.[source.version]?.dist;
      if (!dist || typeof dist.tarball !== "string" || typeof dist.integrity !== "string") throw new ExternalAdapterError("Exact npm adapter version is unavailable");
      if (dist.integrity !== source.integrity) throw new ExternalAdapterError("npm tarball integrity differs from configured integrity");
      bundle = new Uint8Array();
      const archive = await fetchNpm(this.fetcher, dist.tarball, MAX_ARCHIVE_BYTES, "npm tarball");
      if (!verifySriSha512(archive, source.integrity)) throw new ExternalAdapterError("npm tarball SRI verification failed");
      const files = await extractNpmFiles(archive);
      manifestBytes = files.get("dsui.adapter.json") ?? (() => { throw new ExternalAdapterError("npm package lacks root dsui.adapter.json"); })();
      // Validate the manifest once to obtain the only allowed executable path.
      let preliminary: z.infer<typeof adapterManifestSchema>;
      try { preliminary = adapterManifestSchema.parse(JSON.parse(new TextDecoder().decode(manifestBytes))); } catch (error) { throw new ExternalAdapterError("Invalid adapter manifest", error); }
      const entry = bundlePathFromManifest(preliminary);
      bundle = files.get(entry) ?? (() => { throw new ExternalAdapterError("npm package lacks declared adapter bundle"); })();
      for (const file of files.keys()) {
        if (/\.(?:node|wasm|mjs|cjs|js)$/i.test(file) && file !== entry) throw new ExternalAdapterError("npm package contains native code or extra executable chunks");
      }
    } else {
      manifestBytes = await fetchPublic(this.fetcher, githubRawUrl(source.repository, source.commit, "dsui.adapter.json"), MAX_MANIFEST_BYTES, "GitHub manifest");
      let preliminary: z.infer<typeof adapterManifestSchema>;
      try { preliminary = adapterManifestSchema.parse(JSON.parse(new TextDecoder().decode(manifestBytes))); } catch (error) { throw new ExternalAdapterError("Invalid adapter manifest", error); }
      const entry = bundlePathFromManifest(preliminary);
      bundle = await fetchPublic(this.fetcher, githubRawUrl(source.repository, source.commit, entry), MAX_BUNDLE_BYTES, "GitHub adapter bundle");
    }
    const manifest = validateFiles(manifestBytes, bundle, source);
    const manifestPath = await this.saveObject(manifestBytes, ".json");
    const bundlePath = await this.saveObject(bundle, ".mjs");
    const activation: Activation = { id: manifest.id, source, manifestSha256: sha256(manifestBytes), bundleSha256: sha256(bundle), manifestPath, bundlePath, installedAt: new Date().toISOString() };
    await this.atomic(this.activationPath(this.activationKey(manifest.id, source)), JSON.stringify(activation));
    return { ...activation, manifest, manifestPath, bundlePath };
  }
}

export interface ExternalHostRequest { id?: string | number; connection: Record<string, unknown>; operation?: string; input?: unknown; }
export interface ExternalHostClientOptions { command: string; args?: string[]; timeoutMs?: number; maxOutputBytes?: number; }

async function readStreamLimited(stream: ReadableStream<Uint8Array> | null, limit: number, label: string): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try { for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.length; if (length > limit) throw new ExternalAdapterError(`${label} exceeds output limit`); chunks.push(next.value); } }
  finally { reader.releaseLock(); }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** One-request JSON-RPC subprocess client. The host receives EOF after request. */
export class ExternalAdapterHostClient {
  constructor(private readonly options: ExternalHostClientOptions) {}
  async request(request: ExternalHostRequest): Promise<unknown> {
    const max = this.options.maxOutputBytes ?? 256 * 1024;
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const input = JSON.stringify({ jsonrpc: "2.0", id: request.id ?? randomUUID(), method: request.operation ?? "health", params: { connection: request.connection, input: request.input ?? {} } }) + "\n";
    if (Buffer.byteLength(input) > max) throw new ExternalAdapterError("Host request exceeds output limit");
    const child = Bun.spawn([this.options.command, ...(this.options.args ?? [])], { stdin: new Blob([input]).stream(), stdout: "pipe", stderr: "pipe" });
    const timed = new Promise<never>((_, reject) => setTimeout(() => { child.kill(); reject(new ExternalAdapterError("Adapter host timed out")); }, timeoutMs));
    try {
      const [stdout, stderr, code] = await Promise.race([Promise.all([readStreamLimited(child.stdout, max, "Adapter host stdout"), readStreamLimited(child.stderr, max, "Adapter host stderr"), child.exited]), timed]);
      if (code !== 0) throw new ExternalAdapterError(`Adapter host exited with ${code}${stderr ? `: ${stderr.slice(0, 512)}` : ""}`);
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      if (lines.length !== 1) throw new ExternalAdapterError("Adapter host returned an invalid JSON-RPC response");
      let response: any; try { response = JSON.parse(lines[0]); } catch { throw new ExternalAdapterError("Adapter host returned invalid JSON"); }
      if (response?.jsonrpc !== "2.0" || !("id" in response)) throw new ExternalAdapterError("Adapter host returned invalid JSON-RPC");
      if (response.error) throw new ExternalAdapterError(`Adapter host error: ${String(response.error.message ?? "unknown error")}`);
      return response.result;
    } finally { child.kill(); }
  }
}

/**
 * Creates a core-compatible, server-only definition for an installed bundle.
 * The definition intentionally exposes a generic connection object: community
 * connection forms are a later manifest extension, while configured services
 * can still be validated by the adapter host itself.
 *
 * `logicalId` lets configuration register one bundle under a stable local id
 * that may differ from the upstream `manifest.id`.
 */
export function externalAdapterDefinition(
  installed: InstalledExternalAdapter,
  host: { request(request: ExternalHostRequest): Promise<unknown> },
  logicalId: string = installed.id,
): AdapterDefinition {
  const capabilities = installed.manifest.capabilities.map((kind, index) => ({
    id: `${kind}-${index + 1}`,
    authorization: "inspect" as const,
    view: { kind: kind as CapabilityKind, title: kind.replaceAll("-", " ") },
  }));
  return {
    id: logicalId,
    version: installed.manifest.version,
    sdkVersion: ADAPTER_SDK_VERSION,
    metadata: {
      id: logicalId,
      name: installed.manifest.name,
      category: "Community adapter",
      description: `Community adapter ${installed.manifest.name}`,
    },
    connectionSchema: z.record(z.unknown()),
    connectionFields: [],
    secretPaths: [],
    capabilities,
    create(context: AdapterContext, connection: Record<string, unknown>) {
      return {
        async health() {
          return (await host.request({ connection })) as HealthStatus;
        },
        async execute(operationId: string, input: unknown) {
          return host.request({ connection, operation: operationId, input });
        },
        async close() {
          void context;
        },
      };
    },
  };
}
