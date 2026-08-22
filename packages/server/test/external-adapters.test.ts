import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ExternalAdapterError, ExternalAdapterManager, assertSafeAdapterUrl, communityAdapterSourceSchema } from "../src/external-adapters";

const encoder = new TextEncoder();
const commit = "a".repeat(40);

function sri(bytes: Uint8Array): string { return `sha512-${createHash("sha512").update(bytes).digest("base64")}`; }
function digest(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function manifest(bundle: Uint8Array) {
  return encoder.encode(JSON.stringify({ schemaVersion: 1, id: "community-test", name: "Community test", version: "1.2.3", sdkVersion: "0.1.0", entry: "./dist/adapter.mjs", license: "MIT", repository: "https://github.com/acme/community-test", capabilities: ["query"], bundle: { bytes: bundle.length, sha256: digest(bundle) } }));
}

function responseFor(files: Record<string, Uint8Array>) {
  return async (url: string): Promise<Response> => {
    const bytes = files[url];
    return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response("missing", { status: 404 });
  };
}

function tarHeader(name: string, size: number, type = "0"): Uint8Array {
  const block = new Uint8Array(512);
  block.set(encoder.encode(name), 0);
  block.set(encoder.encode(size.toString(8).padStart(11, "0") + "\0"), 124);
  block[156] = type.charCodeAt(0);
  return block;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("community adapter resolver", () => {
  it("installs an immutable raw GitHub adapter and serves it from the offline cache", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsui-adapters-"));
    try {
      const bundle = encoder.encode("export default { connectionSchema: { parse: (x) => x }, create() {} };\n");
      const source = { source: "git" as const, repository: "git+https://github.com/acme/community-test", commit, bundleIntegrity: sri(bundle) };
      const base = `https://raw.githubusercontent.com/acme/community-test/${commit}`;
      const manager = new ExternalAdapterManager({ dataDir: root, fetch: responseFor({ [`${base}/dsui.adapter.json`]: manifest(bundle), [`${base}/dist/adapter.mjs`]: bundle }) });
      const installed = await manager.install(source);
      expect(installed.id).toBe("community-test");
      expect(installed.bundlePath).toContain("objects/sha256/");
      const offline = new ExternalAdapterManager({ dataDir: root, offline: true, fetch: async () => { throw new Error("network used"); } });
      expect((await offline.install(source)).bundleSha256).toBe(digest(bundle));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects redirect-capable hosts, floating git refs, and mismatched raw bundle SRI", async () => {
    expect(() => assertSafeAdapterUrl("https://registry.npmjs.org.evil.test/pkg")).toThrow(ExternalAdapterError);
    expect(() => assertSafeAdapterUrl("http://registry.npmjs.org/pkg")).toThrow("HTTPS");
    expect(() => communityAdapterSourceSchema.parse({ source: "git", repository: "git+https://github.com/acme/repo", commit: "main", integrity: "sha512-aaa=" })).toThrow("commit");
    const root = await mkdtemp(join(tmpdir(), "dsui-adapters-"));
    try {
      const bundle = encoder.encode("export default {};\n");
      const url = `https://raw.githubusercontent.com/acme/repo/${commit}`;
      await expect(new ExternalAdapterManager({ dataDir: root, fetch: responseFor({ [`${url}/dsui.adapter.json`]: manifest(bundle), [`${url}/dist/adapter.mjs`]: bundle }) }).install({ source: "git", repository: "git+https://github.com/acme/repo", commit, integrity: sri(encoder.encode("different")) })).rejects.toThrow("SRI");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects symlinks and extra executable chunks in npm tarballs before activation", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsui-adapters-"));
    try {
      const bundle = encoder.encode("export default {};\n");
      const rawTar = concat([tarHeader("package/dsui.adapter.json", manifest(bundle).length), manifest(bundle), new Uint8Array((512 - manifest(bundle).length % 512) % 512), tarHeader("package/link", 0, "2"), new Uint8Array(1024)]);
      const archive = await gzip(rawTar);
      const source = { source: "npm" as const, package: "community-test", version: "1.2.3", integrity: sri(archive) };
      const tarball = "https://registry.npmjs.org/community-test/-/community-test-1.2.3.tgz";
      const packument = encoder.encode(JSON.stringify({ versions: { "1.2.3": { dist: { tarball, integrity: source.integrity } } } }));
      await expect(new ExternalAdapterManager({ dataDir: root, fetch: responseFor({ "https://registry.npmjs.org/community-test": packument, [tarball]: archive }) }).install(source)).rejects.toThrow("links or special files");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
