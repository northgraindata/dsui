import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSafeAdapterUrl,
  ExternalAdapterError,
  ExternalAdapterManager,
} from "../src/adapters/installer";
import {
  commit,
  concat,
  digest,
  encoder,
  gzip,
  manifest,
  responseFor,
  sri,
  tarHeader,
} from "./fixtures";

describe("community adapter resolver", () => {
  it("installs an immutable raw GitHub adapter and serves it from the offline cache", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsui-adapters-"));
    try {
      const bundle = encoder.encode(
        "export default { connectionSchema: { parse: (x) => x }, create() {} };\n",
      );
      const source = {
        source: "git" as const,
        repository: "git+https://github.com/acme/community-test",
        commit,
        bundleIntegrity: sri(bundle),
      };
      const base = `https://raw.githubusercontent.com/acme/community-test/${commit}`;
      const manager = new ExternalAdapterManager({
        dataDir: root,
        fetch: responseFor({
          [`${base}/dsui.adapter.json`]: manifest(bundle),
          [`${base}/dist/adapter.mjs`]: bundle,
        }),
      });
      const installed = await manager.install(source);
      expect(installed.id).toBe("community-test");
      expect(installed.bundlePath).toContain("objects/sha256/");
      const offline = new ExternalAdapterManager({
        dataDir: root,
        offline: true,
        fetch: async () => {
          throw new Error("network used");
        },
      });
      expect((await offline.install(source)).bundleSha256).toBe(digest(bundle));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects SDK mismatches, unsafe hosts, and mismatched raw bundle SRI", async () => {
    expect(() =>
      assertSafeAdapterUrl("https://registry.npmjs.org.evil.test/pkg"),
    ).toThrow(ExternalAdapterError);
    expect(() => assertSafeAdapterUrl("http://registry.npmjs.org/pkg")).toThrow(
      "HTTPS",
    );
    const root = await mkdtemp(join(tmpdir(), "dsui-adapters-"));
    try {
      const bundle = encoder.encode("export default {};\n");
      const url = `https://raw.githubusercontent.com/acme/repo/${commit}`;
      const source = {
        source: "git" as const,
        repository: "git+https://github.com/acme/repo",
        commit,
        integrity: sri(encoder.encode("different")),
      };
      await expect(
        new ExternalAdapterManager({
          dataDir: root,
          fetch: responseFor({
            [`${url}/dsui.adapter.json`]: manifest(bundle),
            [`${url}/dist/adapter.mjs`]: bundle,
          }),
        }).install(source),
      ).rejects.toThrow("SRI");
      const wrongSdk = encoder.encode("export default {};\n");
      await expect(
        new ExternalAdapterManager({
          dataDir: root,
          fetch: responseFor({
            [`${url}/dsui.adapter.json`]: manifest(wrongSdk, "9.9.9"),
            [`${url}/dist/adapter.mjs`]: wrongSdk,
          }),
        }).install({
          source: "git",
          repository: "git+https://github.com/acme/repo",
          commit,
          integrity: sri(wrongSdk),
        }),
      ).rejects.toThrow("SDK");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects symlinks and extra executable chunks in npm tarballs before activation", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsui-adapters-"));
    try {
      const bundle = encoder.encode("export default {};\n");
      const rawTar = concat([
        tarHeader("package/dsui.adapter.json", manifest(bundle).length),
        manifest(bundle),
        new Uint8Array((512 - (manifest(bundle).length % 512)) % 512),
        tarHeader("package/link", 0, "2"),
        new Uint8Array(1024),
      ]);
      const archive = await gzip(rawTar);
      const source = {
        source: "npm" as const,
        package: "community-test",
        version: "1.2.3",
        integrity: sri(archive),
      };
      const tarball =
        "https://registry.npmjs.org/community-test/-/community-test-1.2.3.tgz";
      const packument = encoder.encode(
        JSON.stringify({
          versions: {
            "1.2.3": { dist: { tarball, integrity: source.integrity } },
          },
        }),
      );
      await expect(
        new ExternalAdapterManager({
          dataDir: root,
          fetch: responseFor({
            "https://registry.npmjs.org/community-test": packument,
            [tarball]: archive,
          }),
        }).install(source),
      ).rejects.toThrow("links or special files");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
