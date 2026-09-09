import { describe, expect, it } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertAdapterDefinition,
  catalogFromDefinition,
  loadAdapter,
} from "../src/adapters/loader";
import { AdapterRegistry } from "../src/adapters/registry";
import fixture from "./fixtures/mini-adapter-source";

const fixturePackage = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "mini-adapter-source.ts",
);

describe("adapter loading", () => {
  it("loads any local package through the uniform path", async () => {
    const loaded = await loadAdapter("fixture", {
      package: fixturePackage,
    });
    expect(loaded.id).toBe("fixture");
    expect(loaded.metadata.name).toBe("Fixture");
    expect(loaded.definition as unknown).toBe(fixture);
    expect(loaded.catalog.resources.map((resource) => resource.id)).toEqual([
      "things",
    ]);
    expect(loaded.catalog.actions.map((action) => action.id)).toEqual([
      "refresh",
    ]);
    expect(loaded.catalog.pages.map((page) => page.path)).toEqual(["/things"]);
    expect(loaded.connectionSchema).toBeUndefined();
  });

  it("rejects id mismatches and unknown packages", async () => {
    await expect(
      loadAdapter("not-fixture", { package: fixturePackage }),
    ).rejects.toThrow('registered as "not-fixture"');
    await expect(
      loadAdapter("missing", { package: "@acme/does-not-exist-xyz" }),
    ).rejects.toThrow("Cannot load adapter package");
  });

  it("rejects non-adapter modules", () => {
    expect(() => assertAdapterDefinition(null, "test")).toThrow(
      "Invalid adapter definition",
    );
    expect(() => assertAdapterDefinition({ kind: "adapter" }, "test")).toThrow(
      "metadata.id",
    );
    expect(() =>
      assertAdapterDefinition(
        {
          kind: "adapter",
          metadata: { id: "x", name: "X", version: "1.0.0" },
          sdkVersion: "9.9.9",
          createContext: () => ({}),
          stores: [],
          resources: [],
          actions: [],
          pages: [],
        },
        "test",
      ),
    ).toThrow("host requires 0.2.0");
  });

  it("builds catalogs from live definitions", () => {
    const catalog = catalogFromDefinition(fixture);
    expect(catalog.pages).toEqual([{ path: "/things" }]);
    expect(
      catalog.resources.find((resource) => resource.id === "things"),
    ).toMatchObject({ id: "things" });
  });

  it("serializes connection methods from the definition", async () => {
    const loaded = await loadAdapter("duckdb", {
      package: "@northgraindata/dsui-adapter-duckdb",
    });
    expect(loaded.connectionMethods?.map((method) => method.id)).toEqual([
      "memory",
      "file",
      "s3",
    ]);
    expect(loaded.connectionMethods?.[0]?.label).toBe("In-memory");
    expect(loaded.connectionMethods?.[0]?.schema).toMatchObject({
      type: "object",
    });
    expect(loaded.connectionMethods?.[2]?.group).toMatchObject({
      id: "remote",
      label: "Remote",
    });
  });
});

describe("adapter registry", () => {
  it("registers, retrieves, and patches metadata without imports", async () => {
    const loaded = await loadAdapter("fixture", {
      package: fixturePackage,
    });
    const registry = new AdapterRegistry([loaded]);
    expect(registry.list().map((adapter) => adapter.id)).toEqual(["fixture"]);
    expect(() => registry.register(loaded)).toThrow("already registered");
    expect(() => registry.get("kafka")).toThrow("Unknown adapter: kafka");
    registry.applyMetadata("fixture", { name: "Fixture Renamed" });
    expect(registry.get("fixture").metadata.name).toBe("Fixture Renamed");
    registry.applyMetadata("unknown-id", { name: "x" });
  });
});
