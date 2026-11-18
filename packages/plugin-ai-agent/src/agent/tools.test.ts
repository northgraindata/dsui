import { describe, expect, it } from "bun:test";
import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import { type Config, configSchema } from "./model";
import { executeTool } from "./tools";

function harness() {
  const permissions: string[] = [];
  const calls: unknown[][] = [];
  const service = {
    id: "svc-1",
    name: "Example",
  };
  const context = {
    config: configSchema.parse({}),
    access: {
      require: async (id: string, permission: string) => {
        permissions.push(`${id}:${permission}`);
      },
    },
    services: {
      list: async () => ({ items: [service] }),
      get: async () => service,
      listResources: async () => [
        { id: "arbitrary-resource", inputSchema: { type: "array" } },
      ],
      listActions: async () => [
        { id: "arbitrary-action", inputSchema: { type: "string" } },
      ],
      queryResource: async (...args: unknown[]) => {
        calls.push(args);
        return { ok: true };
      },
      executeAction: async (...args: unknown[]) => {
        calls.push(args);
        return { changed: true };
      },
      probe: async () => null,
    },
    plugins: {
      list: async () => [
        {
          id: "capability-plugin",
          name: "Capability plugin",
          version: "1.0.0",
          status: "ready",
        },
      ],
      listResources: async () => [
        { id: "plugin-resource", inputSchema: { type: "object" } },
      ],
      listActions: async () => [
        {
          id: "plugin-action",
          permission: "execute",
          inputSchema: { type: "object" },
        },
      ],
      queryResource: async (...args: unknown[]) => {
        calls.push(args);
        return { plugin: true };
      },
      executeAction: async (...args: unknown[]) => {
        calls.push(args);
        return { changed: true };
      },
    },
    events: { read: async () => ({ items: [], cursor: "", hasMore: false }) },
  } as unknown as PluginContext<Config>;
  return { context, calls, permissions };
}

describe("generic service tools", () => {
  it("discovers declared resources and actions without provider-specific knowledge", async () => {
    const { context } = harness();
    const resources = await executeTool(context, [], "list_resources", {
      serviceId: "svc-1",
    });
    const actions = await executeTool(context, [], "list_actions", {
      serviceId: "svc-1",
    });
    expect(resources).toMatchObject({
      resources: [{ id: "arbitrary-resource", inputSchema: { type: "array" } }],
    });
    expect(actions).toMatchObject({
      actions: [{ id: "arbitrary-action", inputSchema: { type: "string" } }],
    });
  });

  it("passes arbitrary JSON resource input through the generic query contract", async () => {
    const { context, calls } = harness();
    await executeTool(context, [], "query_resource", {
      serviceId: "svc-1",
      resourceId: "arbitrary-resource",
      input: ["x", 4, { nested: true }],
    });
    expect(calls).toEqual([
      ["svc-1", "arbitrary-resource", ["x", 4, { nested: true }]],
    ]);
  });

  it("requires execute permission before dispatching the declared action", async () => {
    const { context, calls, permissions } = harness();
    const controller = new AbortController();
    await executeTool(
      context,
      [],
      "execute_action",
      {
        serviceId: "svc-1",
        actionId: "arbitrary-action",
        input: "confirm",
      },
      controller.signal,
    );
    expect(permissions).toContain("svc-1:execute");
    expect(calls).toEqual([
      ["svc-1", "arbitrary-action", "confirm", { signal: controller.signal }],
    ]);
  });
});

describe("generic plugin tools", () => {
  it("discovers plugins and their declared resources and actions", async () => {
    const { context } = harness();
    expect(await executeTool(context, [], "list_plugins", {})).toMatchObject({
      plugins: [{ id: "capability-plugin" }],
    });
    expect(
      await executeTool(context, [], "list_plugin_resources", {
        pluginId: "capability-plugin",
      }),
    ).toMatchObject({ resources: [{ id: "plugin-resource" }] });
    expect(
      await executeTool(context, [], "list_plugin_actions", {
        pluginId: "capability-plugin",
      }),
    ).toMatchObject({
      actions: [{ id: "plugin-action", permission: "execute" }],
    });
  });

  it("dispatches plugin resources and actions through host operations", async () => {
    const { context, calls } = harness();
    await executeTool(context, [], "query_plugin_resource", {
      pluginId: "capability-plugin",
      resourceId: "plugin-resource",
      input: { arbitrary: [1, "x"] },
    });
    await executeTool(context, [], "execute_plugin_action", {
      pluginId: "capability-plugin",
      actionId: "plugin-action",
      input: { arbitrary: { nested: true } },
    });
    expect(calls).toEqual([
      ["capability-plugin", "plugin-resource", { arbitrary: [1, "x"] }],
      [
        "capability-plugin",
        "plugin-action",
        { arbitrary: { nested: true } },
        undefined,
      ],
    ]);
  });
});
