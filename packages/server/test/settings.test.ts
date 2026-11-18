import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installationDefaults,
  preferenceDefaults,
  type SettingsSnapshot,
} from "@northgraindata/dsui-core";
import {
  definePage,
  definePlugin,
  type PluginPrincipal,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import { createRuntime } from "../src/app";
import type { DsuiConfig } from "../src/config";

const put = (value: unknown, revision = 0) => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ value, revision }),
});

test("settings persist across restarts, reject stale saves and keep YAML overrides out of stored defaults", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-settings-"));
  const config: DsuiConfig = { services: [] };
  const start = () => createRuntime({ dataDir: root, config });
  let runtime = start();
  const read = async (): Promise<SettingsSnapshot> =>
    (await runtime.app.request("/api/v1/settings")).json();
  try {
    await runtime.refreshConfig();
    expect((await read()).installation).toEqual(installationDefaults);
    const saved = await runtime.app.request(
      "/api/v1/settings/installation",
      put({ ...installationDefaults, name: "Analytics" }),
    );
    expect(saved.status).toBe(200);
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/installation",
          put(installationDefaults),
        )
      ).status,
    ).toBe(409);
    config.settings = { name: "Managed production" };
    expect((await read()).managed).toEqual(["name"]);
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/installation",
          put({ ...installationDefaults, name: "Bypass" }, 1),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/installation",
          put(
            {
              ...installationDefaults,
              name: "Managed production",
              environment: "staging",
            },
            1,
          ),
        )
      ).status,
    ).toBe(200);
    config.settings = undefined;
    expect((await read()).installation.name).toBe("Analytics");
    expect((await read()).installation.environment).toBe("staging");
    await runtime.close();
    runtime = start();
    await runtime.refreshConfig();
    expect((await read()).installation.name).toBe("Analytics");
    expect((await read()).revision.installation).toBe(2);
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/preferences",
          put({
            ...preferenceDefaults,
            timeZone: "Mars/Olympus",
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/preferences",
          put({ ...preferenceDefaults, editorFontSize: 99 }),
        )
      ).status,
    ).toBe(422);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("settings are isolated per principal and installation administration is enforced on the server", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-settings-access-"));
  let principal: PluginPrincipal | null = { id: "alice", role: "owner" };
  const security = definePlugin({
    metadata: {
      id: "identity",
      name: "Identity",
      version: "1.0.0",
      apiVersion: 1,
      security: true,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.authentication({ authenticate: () => principal });
    },
  });
  const runtime = createRuntime({
    dataDir: root,
    config: {
      services: [],
      plugins: {
        identity: {
          package: "identity-test",
          enabled: true,
          critical: true,
          config: {},
        },
      },
    },
    pluginModuleLoader: async () => ({ default: security }),
  });
  try {
    await runtime.refreshConfig();
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/preferences",
          put({ ...preferenceDefaults, editorFontSize: 18 }),
        )
      ).status,
    ).toBe(200);
    principal = { id: "bob", role: "viewer" };
    const bob: SettingsSnapshot = await (
      await runtime.app.request("/api/v1/settings")
    ).json();
    expect(bob.preferences.editorFontSize).toBe(13);
    expect(bob.canManage).toBe(false);
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/installation",
          put(installationDefaults),
        )
      ).status,
    ).toBe(403);
    expect((await runtime.app.request("/api/v1/settings/system")).status).toBe(
      403,
    );
    expect(
      (
        await runtime.app.request(
          "/api/v1/settings/preferences",
          put({ ...preferenceDefaults, density: "compact" }),
        )
      ).status,
    ).toBe(200);
    principal = { id: "alice", role: "owner" };
    expect(
      (await (await runtime.app.request("/api/v1/settings")).json()).preferences
        .editorFontSize,
    ).toBe(18);
    principal = null;
    expect((await runtime.app.request("/api/v1/settings")).status).toBe(401);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("arbitrary plugins opt into Settings dynamically and disabled plugins contribute nothing", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-settings-plugins-"));
  let role: PluginPrincipal["role"] = "owner";
  const security = definePlugin({
    metadata: {
      id: "identity",
      name: "Identity",
      version: "1.0.0",
      apiVersion: 1,
      security: true,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.authentication({ authenticate: () => ({ id: "tester", role }) });
    },
  });
  const extension = definePlugin({
    metadata: {
      id: "custom-tool",
      name: "Custom tool",
      version: "2.0.0",
      apiVersion: 1,
    },
    configSchema: z.object({ secret: z.string() }),
    setup(registry) {
      registry.page(definePage({ path: "/configuration", render: () => [] }), {
        id: "configuration",
        title: "Custom configuration",
        settings: {
          category: "Tools",
          label: "Custom tool",
          permission: "manage",
        },
      });
    },
  });
  const config: DsuiConfig = {
    services: [],
    plugins: {
      identity: {
        package: "identity-test",
        enabled: true,
        critical: true,
        config: {},
      },
      "custom-tool": {
        package: "custom-test",
        enabled: true,
        config: { secret: "NEVER_EXPOSE_THIS" },
      },
    },
  };
  const start = () =>
    createRuntime({
      dataDir: root,
      config,
      pluginModuleLoader: async (name) => ({
        default: name === "identity-test" ? security : extension,
      }),
    });
  let runtime = start();
  try {
    await runtime.refreshConfig();
    const catalog = await (await runtime.app.request("/api/v1/plugins")).json();
    expect(
      catalog.pages.find(
        (page: { pluginId: string }) => page.pluginId === "custom-tool",
      ).settings.label,
    ).toBe("Custom tool");
    const system = await (
      await runtime.app.request("/api/v1/settings/system")
    ).text();
    expect(system).not.toContain("NEVER_EXPOSE_THIS");
    expect(system).not.toContain("secret");
    expect(
      (
        await runtime.app.request(
          "/api/v1/plugins/custom-tool/pages/configuration",
        )
      ).status,
    ).toBe(200);
    role = "viewer";
    expect(
      (
        await runtime.app.request(
          "/api/v1/plugins/custom-tool/pages/configuration",
        )
      ).status,
    ).toBe(403);
    const filtered = await (
      await runtime.app.request("/api/v1/plugins")
    ).json();
    expect(
      filtered.pages.find(
        (page: { pluginId: string }) => page.pluginId === "custom-tool",
      ).settings,
    ).toBeUndefined();
    await runtime.close();
    if (config.plugins) config.plugins["custom-tool"].enabled = false;
    runtime = start();
    await runtime.refreshConfig();
    const disabled = await (
      await runtime.app.request("/api/v1/plugins")
    ).json();
    expect(
      disabled.pages.some(
        (page: { pluginId: string }) => page.pluginId === "custom-tool",
      ),
    ).toBe(false);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});
