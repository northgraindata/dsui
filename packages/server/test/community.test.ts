import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter } from "../src/adapters/loader";
import {
  concat,
  encoder,
  gzip,
  manifest,
  responseFor,
  sri,
  tarHeader,
} from "./fixtures";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Full community path with real subprocesses: bundle the fixture,
 * install it verified from a mocked registry, then describe, probe,
 * and execute through adapter-host isolation.
 */
describe("community adapter end to end", () => {
  it("installs, describes, probes, and executes an npm adapter", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsui-community-"));
    try {
      const built = await Bun.build({
        entrypoints: [join(here, "fixtures", "mini-adapter-source.ts")],
        target: "bun",
        format: "esm",
        minify: false,
      });
      if (!built.success)
        throw new Error(`fixture bundle failed: ${built.logs.join("\n")}`);
      const bundled = built.outputs[0];
      if (!bundled) throw new Error("fixture bundle produced no output");
      const bundle = new Uint8Array(await bundled.arrayBuffer());
      const manifestBytes = manifest(bundle);
      const rawTar = concat([
        tarHeader("package/dsui.adapter.json", manifestBytes.length),
        manifestBytes,
        new Uint8Array((512 - (manifestBytes.length % 512)) % 512),
        tarHeader("package/dist/adapter.mjs", bundle.length),
        bundle,
        new Uint8Array((512 - (bundle.length % 512)) % 512),
        new Uint8Array(1024),
      ]);
      const archive = await gzip(rawTar);
      const tarball =
        "https://registry.npmjs.org/community-fixture/-/community-fixture-1.2.3.tgz";
      const packument = encoder.encode(
        JSON.stringify({
          versions: {
            "1.2.3": { dist: { tarball, integrity: sri(archive) } },
          },
        }),
      );
      const source = {
        source: "npm" as const,
        package: "community-fixture",
        version: "1.2.3",
        integrity: sri(archive),
      };
      const fetch = responseFor({
        "https://registry.npmjs.org/community-fixture": packument,
        [tarball]: archive,
      });
      const loaded = await loadAdapter("fixture", source, {
        dataDir: root,
        fetch,
      });
      expect(loaded.id).toBe("fixture");
      expect(loaded.metadata.name).toBe("Fixture");
      expect(loaded.catalog.pages).toEqual([{ path: "/things" }]);

      const health = await loaded.backend.checkHealth({});
      expect(health.status).toBe("healthy");

      const resource = await loaded.backend.executeResource("things", {}, {});
      expect(resource).toEqual({
        data: [{ name: "alpha" }, { name: "beta" }],
      });

      const action = await loaded.backend.executeAction("refresh", {}, {});
      expect(action).toEqual({ status: "success", data: "refreshed" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
