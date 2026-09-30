import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { definePlugin, PageHeader, PLUGIN_API_VERSION } from "./index";

describe("definePlugin", () => {
  test("marks a plugin definition with the current kind and API version", () => {
    const plugin = definePlugin({
      metadata: {
        id: "example-plugin",
        name: "Example Plugin",
        version: "1.0.0",
        apiVersion: PLUGIN_API_VERSION,
      },
      configSchema: z.object({ enabled: z.boolean() }),
      setup(registry, config) {
        registry.page({
          id: "home",
          title: config.enabled ? "Home" : "Off",
          render: () => PageHeader({ title: config.enabled ? "Home" : "Off" }),
        });
      },
    });

    expect(plugin.kind).toBe("dsui-plugin");
    expect(plugin.metadata.apiVersion).toBe(1);
    expect(plugin.configSchema.parse({ enabled: true })).toEqual({
      enabled: true,
    });
  });
});
