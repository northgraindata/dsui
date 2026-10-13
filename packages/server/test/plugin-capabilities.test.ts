import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginPrincipal } from "@northgraindata/dsui-plugin-sdk";
import {
  defineAction,
  definePlugin,
  defineResource,
  manual,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import { createRuntime } from "../src/app";

test("plugins can discover and invoke other plugin capabilities with host permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-plugin-capabilities-"));
  let role: PluginPrincipal["role"] = "owner";
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
        authenticate: () => ({ id: "tester", role }),
      });
    },
  });
  const target = definePlugin({
    metadata: {
      id: "target",
      name: "Target plugin",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.resource(
        defineResource({
          id: "value",
          input: z.object({ prefix: z.string() }),
          refresh: manual(),
          query: ({ prefix }) => ({ value: `${prefix}result` }),
        }),
      );
      registry.action(
        defineAction({
          id: "change",
          input: z.object({ value: z.string() }),
          permission: "execute",
          run: ({ value }) => ({ changed: value }),
        }),
      );
    },
  });
  const consumer = definePlugin({
    metadata: {
      id: "ai-agent",
      name: "Consumer",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.action(
        defineAction({
          id: "inspect-target",
          input: z.object({}),
          permission: "inspect",
          run: async (_input, context) => {
            const plugins = await context.plugins.list();
            const resources = await context.plugins.listResources("target");
            const actions = await context.plugins.listActions("target");
            const data = await context.plugins.queryResource(
              "target",
              "value",
              { prefix: "host-" },
            );
            return { plugins, resources, actions, data };
          },
        }),
      );
      registry.action(
        defineAction({
          id: "execute-target",
          input: z.object({ value: z.string() }),
          permission: "inspect",
          run: ({ value }, context) =>
            context.plugins.executeAction("target", "change", { value }),
        }),
      );
    },
  });
  const modules = new Map([
    ["security-test", security],
    ["target-test", target],
    ["consumer-test", consumer],
  ]);
  const runtime = createRuntime({
    dataDir: join(root, "state"),
    config: {
      services: [],
      plugins: {
        security: {
          package: "security-test",
          enabled: true,
          critical: true,
          config: {},
        },
        target: { package: "target-test", enabled: true, config: {} },
        "ai-agent": { package: "consumer-test", enabled: true, config: {} },
      },
    },
    pluginModuleLoader: async (specifier) => ({
      default: modules.get(specifier),
    }),
  });
  const call = (actionId: string, input: unknown = {}) =>
    runtime.app.request(`/api/v1/plugins/ai-agent/procedures/${actionId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  try {
    await runtime.refreshConfig();
    const discovered = await call("inspect-target");
    expect(discovered.status).toBe(200);
    const result = (await discovered.json()).data;
    expect(result.plugins.map((plugin: { id: string }) => plugin.id)).toContain(
      "target",
    );
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].inputSchema.properties.prefix.type).toBe(
      "string",
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      id: "change",
      permission: "execute",
    });
    expect(result.data).toEqual({ value: "host-result" });
    const executed = await call("execute-target", { value: "allowed" });
    expect(executed.status).toBe(200);
    expect(await executed.json()).toMatchObject({
      data: { changed: "allowed" },
    });
    expect(
      runtime.database.sqlite
        .query(
          "SELECT action, target FROM audit_events WHERE action = 'plugin.action.execute'",
        )
        .all(),
    ).toHaveLength(1);
    role = "viewer";
    const denied = await call("execute-target", { value: "blocked" });
    expect(denied.status).toBe(403);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});
