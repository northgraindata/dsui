import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sdkVersions } from "../../../scripts/release-packages";
import { assertAdapterDefinition } from "../src/adapters/definition";
import { prepareSdk, sdkPackageAt } from "../src/adapters/sdk";

test("prepared runtime SDKs retain their independent package versions", async () => {
  const target = await mkdtemp(join(tmpdir(), "dsui-sdk-versions-"));
  try {
    const packages = resolve(import.meta.dir, "../..");
    await prepareSdk(packages, target, false);
    for (const directory of ["ui", "adapter-sdk", "plugin-sdk"]) {
      const original = JSON.parse(
        await readFile(join(packages, directory, "package.json"), "utf8"),
      );
      const prepared = JSON.parse(
        await readFile(
          join(sdkPackageAt(target, original.name), "package.json"),
          "utf8",
        ),
      );
      expect(prepared.version).toBe(original.version);
      expect(Object.values(prepared.dependencies)).not.toContain("workspace:*");
    }
    expect(Object.keys(await sdkVersions())).toEqual([
      "@northgraindata/dsui-adapter-sdk",
      "@northgraindata/dsui-plugin-sdk",
    ]);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

const definition = {
  kind: "adapter",
  metadata: { id: "test" },
  sdkVersion: "0.2.0",
  createContext: () => ({}),
  stores: [],
  resources: [],
  actions: [],
  pages: [],
};
test("legacy adapters remain compatible; explicit incompatible API is rejected", () => {
  expect(assertAdapterDefinition(definition, "legacy").metadata.id).toBe(
    "test",
  );
  expect(
    assertAdapterDefinition(
      { ...definition, sdkVersion: "0.9.5", apiVersion: "0.2.0" },
      "modern",
    ).metadata.id,
  ).toBe("test");
  expect(() =>
    assertAdapterDefinition(
      { ...definition, apiVersion: "9.0.0" },
      "incompatible",
    ),
  ).toThrow("adapter API");
});
