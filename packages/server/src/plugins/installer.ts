import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { PluginSource } from "../config.js";

const MAX_MANIFEST = 64 * 1024;
const MAX_BUNDLE = 5 * 1024 * 1024;

const artifactSchema = z
  .object({
    entry: z.string().regex(/^\.\/dist\/[a-z0-9/_-]+\.mjs$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive().max(MAX_BUNDLE),
  })
  .strict();

export const pluginManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    apiVersion: z.literal(1),
    server: artifactSchema,
    browser: artifactSchema.optional(),
  })
  .strict();

type GitSource = Extract<PluginSource, { source: "git" }>;
export type PluginFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type VerifiedPlugin = {
  serverPath: string;
  browserPath?: string;
  manifest: z.infer<typeof pluginManifestSchema>;
};

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function verifyIntegrity(bytes: Uint8Array, integrity: string): boolean {
  const expected = Buffer.from(integrity.slice("sha512-".length), "base64");
  const actual = createHash("sha512").update(bytes).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function rawUrl(source: GitSource, path: string): string {
  const match =
    /^git\+https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(
      source.repository,
    );
  if (!match || !/^[a-f0-9]{40}$/.test(source.commit))
    throw new Error("Invalid pinned GitHub plugin source");
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${source.commit}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function fetchLimited(
  fetcher: PluginFetch,
  url: string,
  limit: number,
): Promise<Uint8Array> {
  const response = await fetcher(url, { redirect: "error" });
  if (!response.ok || response.redirected || !response.body)
    throw new Error("Plugin artifact download failed");
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > limit) throw new Error("Plugin artifact exceeds size limit");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Plugin artifact exceeds size limit");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function verifyBundle(
  bytes: Uint8Array,
  artifact: z.infer<typeof artifactSchema>,
): void {
  if (bytes.length !== artifact.bytes || digest(bytes) !== artifact.sha256)
    throw new Error("Plugin artifact differs from manifest");
  const text = new TextDecoder().decode(bytes);
  if (
    /\bimport\s*(?:\(|(?:[^;]*?\s+from\s*)?["'])/m.test(text) ||
    /\bexport\s+[^;]*\s+from\s*["']/m.test(text)
  )
    throw new Error("Plugin artifact imports another module");
}

async function writeImmutable(path: string, bytes: Uint8Array): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, path);
}

async function readLimited(path: string, limit: number): Promise<Uint8Array> {
  if ((await stat(path)).size > limit)
    throw new Error("Cached plugin artifact exceeds size limit");
  return readFile(path);
}

/** Pinned, prebuilt artifacts only. Hashes authenticate bytes, not the author. */
export async function installGitPlugin(
  id: string,
  source: GitSource,
  options: { dataDir: string; fetch?: PluginFetch; offline?: boolean },
): Promise<VerifiedPlugin> {
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        id,
        repository: source.repository,
        commit: source.commit,
        integrity: source.integrity,
      }),
    )
    .digest("hex");
  const directory = join(options.dataDir, "plugins", cacheKey);
  const manifestPath = join(directory, "plugin.json");
  const serverPath = join(directory, "server.mjs");
  const browserPath = join(directory, "browser.mjs");

  let manifestBytes: Uint8Array;
  let fetchedManifest = false;
  try {
    manifestBytes = await readLimited(manifestPath, MAX_MANIFEST);
  } catch {
    if (options.offline)
      throw new Error("Verified plugin is unavailable offline");
    manifestBytes = await fetchLimited(
      options.fetch ?? fetch,
      rawUrl(source, "plugin.json"),
      MAX_MANIFEST,
    );
    fetchedManifest = true;
  }
  if (
    manifestBytes.length > MAX_MANIFEST ||
    !verifyIntegrity(manifestBytes, source.integrity)
  )
    throw new Error("Plugin manifest integrity mismatch");
  const manifest = pluginManifestSchema.parse(
    JSON.parse(new TextDecoder().decode(manifestBytes)),
  );
  if (manifest.id !== id)
    throw new Error("Plugin manifest id differs from configuration");

  async function artifact(
    path: string,
    spec: z.infer<typeof artifactSchema>,
  ): Promise<{ bytes: Uint8Array; fetched: boolean }> {
    let bytes: Uint8Array;
    try {
      bytes = await readLimited(path, MAX_BUNDLE);
      verifyBundle(bytes, spec);
      return { bytes, fetched: false };
    } catch {
      if (options.offline)
        throw new Error("Verified plugin artifact is unavailable offline");
      bytes = await fetchLimited(
        options.fetch ?? fetch,
        rawUrl(source, spec.entry.slice(2)),
        MAX_BUNDLE,
      );
      verifyBundle(bytes, spec);
      return { bytes, fetched: true };
    }
  }
  const server = await artifact(serverPath, manifest.server);
  const browser = manifest.browser
    ? await artifact(browserPath, manifest.browser)
    : undefined;
  if (fetchedManifest || server.fetched || browser?.fetched) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (fetchedManifest) await writeImmutable(manifestPath, manifestBytes);
    if (server.fetched) await writeImmutable(serverPath, server.bytes);
    if (browser?.fetched) await writeImmutable(browserPath, browser.bytes);
  }
  return { serverPath, ...(browser ? { browserPath } : {}), manifest };
}
