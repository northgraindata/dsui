import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { definePage, definePlugin, z } from "@northgraindata/dsui-plugin-sdk";
import { createRuntime } from "../src/app";

const iconUrl = "data:image/webp;base64,UklGRg==";

test("catalog publishes optional plugin branding, retains legacy plugins, and filters denied metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-plugin-branding-"));
  const security = definePlugin({
    metadata: {
      id: "security",
      name: "Security",
      version: "1.0.0",
      apiVersion: 1,
      security: true,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.authentication({
        authenticate: () => ({ id: "viewer", role: "viewer" }),
      });
      registry.authorization({
        authorize: ({ resource }) => resource?.id !== "hidden",
      });
    },
  });
  const branded = (id: string) =>
    definePlugin({
      metadata: {
        id,
        name: id,
        version: "1.0.0",
        apiVersion: 1,
        category: "Monitoring",
        iconUrl,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.page(definePage({ path: "/overview", render: () => [] }), {
          id: "overview",
          title: id,
        });
        registry.navigation({
          id: "main",
          area: "primary",
          label: id,
          pageId: "overview",
        });
      },
    });
  const legacy = definePlugin({
    metadata: { id: "legacy", name: "Legacy", version: "1.0.0", apiVersion: 1 },
    configSchema: z.object({}),
    setup() {
      // This legacy plugin contributes no pages.
    },
  });
  const modules = new Map([
    ["security", security],
    ["timeline", branded("timeline")],
    ["hidden", branded("hidden")],
    ["legacy", legacy],
  ]);
  const runtime = createRuntime({
    dataDir: root,
    config: {
      services: [],
      plugins: Object.fromEntries(
        [...modules.keys()].map((id) => [
          id,
          {
            package: id,
            enabled: true,
            critical: id === "security",
            config: {},
          },
        ]),
      ),
    },
    pluginModuleLoader: async (id) => ({ default: modules.get(id) }),
  });
  try {
    await runtime.refreshConfig();
    const response = await runtime.app.request("/api/v1/plugins");
    expect(response.status).toBe(200);
    const catalog = await response.json();
    expect(
      catalog.plugins.find((item: { id: string }) => item.id === "timeline"),
    ).toMatchObject({ category: "Monitoring", iconUrl, status: "ready" });
    const old = catalog.plugins.find(
      (item: { id: string }) => item.id === "legacy",
    );
    expect(old.status).toBe("ready");
    expect(old).not.toHaveProperty("category");
    expect(old).not.toHaveProperty("iconUrl");
    expect(
      catalog.plugins.some((item: { id: string }) => item.id === "hidden"),
    ).toBe(false);
    expect(
      catalog.navigation.map((item: { pluginId: string }) => item.pluginId),
    ).toEqual(["timeline"]);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});

test.each(["category", "iconUrl"])(
  "rejects a non-string metadata.%s before publishing contributions",
  async (field) => {
    const root = await mkdtemp(join(tmpdir(), "dsui-plugin-branding-invalid-"));
    const plugin = definePlugin({
      metadata: {
        id: "invalid",
        name: "Invalid",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.page(definePage({ path: "/overview", render: () => [] }), {
          id: "overview",
          title: "Invalid",
        });
        registry.navigation({
          id: "main",
          area: "primary",
          label: "Invalid",
          pageId: "overview",
        });
      },
    });
    const runtime = createRuntime({
      dataDir: root,
      config: {
        services: [],
        plugins: { invalid: { package: "fixture", enabled: true, config: {} } },
      },
      pluginModuleLoader: async () => ({
        default: { ...plugin, metadata: { ...plugin.metadata, [field]: 123 } },
      }),
    });
    try {
      await runtime.refreshConfig();
      const catalog = await (
        await runtime.app.request("/api/v1/plugins")
      ).json();
      expect(catalog.plugins[0].status).toBe("unavailable");
      expect(catalog.navigation).toEqual([]);
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("a navigation entry may carry its own icon, and other plugins see a plugin's icon", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-plugin-branding-entry-"));
  let seen: unknown;
  const health = definePlugin({
    metadata: {
      id: "health",
      name: "Health",
      version: "1.0.0",
      apiVersion: 1,
      iconUrl,
    },
    configSchema: z.object({}),
    setup(registry) {
      for (const id of ["overview", "status-pages"])
        registry.page(definePage({ path: `/${id}`, render: () => [] }), {
          id,
          title: id,
        });
      registry.navigation({
        id: "health",
        area: "primary",
        label: "Health",
        pageId: "overview",
      });
      registry.navigation({
        id: "status-pages",
        area: "primary",
        label: "Status pages",
        pageId: "status-pages",
        iconUrl: "data:image/webp;base64,cGFnZXM=",
      });
    },
  });
  const reader = definePlugin({
    metadata: { id: "reader", name: "Reader", version: "1.0.0", apiVersion: 1 },
    configSchema: z.object({}),
    setup(registry) {
      registry.page(
        definePage({
          path: "/overview",
          render: async ({ context }) => {
            seen = await context.plugins.get("health");
            return [];
          },
        }),
        { id: "overview", title: "Reader" },
      );
    },
  });
  const modules = new Map([
    ["health", health],
    ["reader", reader],
  ]);
  const runtime = createRuntime({
    dataDir: root,
    config: {
      services: [],
      plugins: Object.fromEntries(
        [...modules.keys()].map((id) => [
          id,
          { package: id, enabled: true, config: {} },
        ]),
      ),
    },
    pluginModuleLoader: async (id) => ({ default: modules.get(id) }),
  });
  try {
    await runtime.refreshConfig();
    const catalog = await (await runtime.app.request("/api/v1/plugins")).json();
    expect(
      catalog.navigation.map((item: { id: string; iconUrl?: string }) => [
        item.id,
        item.iconUrl ?? null,
      ]),
    ).toEqual([
      ["health", null],
      ["status-pages", "data:image/webp;base64,cGFnZXM="],
    ]);
    await runtime.app.request("/api/v1/plugins/reader/pages/overview");
    expect(seen).toMatchObject({ id: "health", iconUrl });
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});
