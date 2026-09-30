import { describe, expect, test } from "bun:test";
import { definePlugin } from "@northgraindata/dsui-plugin-sdk";
import { Hono } from "hono";
import { z } from "zod";
import type { PluginSource } from "../config";
import { registerPluginRoutes } from "./routes";
import { PluginRuntime } from "./runtime";

function source(packageName: string, enabled = true): PluginSource {
  return { package: packageName, enabled, config: {} };
}

const noServices = {
  list: async () => ({ items: [] }),
  get: async () => null,
};

describe("PluginRuntime", () => {
  test("validates config, registers pages and navigation, and starts in dependency order", async () => {
    const started: string[] = [];
    const stopped: string[] = [];
    const base = definePlugin({
      metadata: {
        id: "base-plugin",
        name: "Base",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({ label: z.string().default("Base page") }),
      setup(registry, config) {
        registry.page({ id: "home", title: config.label ?? "Base page" });
        registry.navigation({
          id: "home-link",
          area: "primary",
          label: "Home",
          pageId: "home",
        });
        registry.procedure({
          id: "greet",
          permission: "inspect",
          input: z.object({ name: z.string() }),
          output: z.string(),
          handler: (_context, input) => `Hello ${input.name}`,
        });
      },
      start: ({ pluginId }) => {
        started.push(pluginId);
      },
      stop: () => {
        stopped.push("base-plugin");
      },
    });
    const dependent = definePlugin({
      metadata: {
        id: "dependent-plugin",
        name: "Dependent",
        version: "1.0.0",
        apiVersion: 1,
      },
      requires: ["base-plugin"],
      configSchema: z.object({}),
      setup() {},
      start: ({ pluginId }) => {
        started.push(pluginId);
      },
      stop: () => {
        stopped.push("dependent-plugin");
      },
    });
    const runtime = new PluginRuntime(noServices, async (specifier) =>
      specifier === "base"
        ? { default: base }
        : specifier === "dependent"
          ? { default: dependent }
          : {},
    );

    await runtime.load({
      "dependent-plugin": source("dependent"),
      "base-plugin": { ...source("base"), config: { label: "Overview" } },
    });

    expect(started).toEqual(["base-plugin", "dependent-plugin"]);
    expect(runtime.catalog()).toMatchObject({
      plugins: [
        { id: "base-plugin", status: "ready" },
        { id: "dependent-plugin", status: "ready" },
      ],
      pages: [{ id: "home", title: "Overview", pluginId: "base-plugin" }],
      navigation: [{ id: "home-link", pluginId: "base-plugin" }],
    });
    const procedure = runtime.procedure("base-plugin", "greet");
    expect(procedure).not.toBeNull();
    expect(await procedure?.procedure.invoke({ name: "DSUI" })).toBe(
      "Hello DSUI",
    );
    await runtime.close();
    expect(stopped).toEqual(["dependent-plugin", "base-plugin"]);
  });

  test("keeps disabled and failed plugins out of the contribution catalog", async () => {
    const available = definePlugin({
      metadata: {
        id: "available-plugin",
        name: "Available",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.page({ id: "page", title: "Page" });
      },
    });
    const runtime = new PluginRuntime(noServices, async (specifier) =>
      specifier === "available" ? { default: available } : {},
    );

    await runtime.load({
      "available-plugin": source("available"),
      "disabled-plugin": source("available", false),
      "missing-plugin": source("missing"),
    });

    const catalog = runtime.catalog();
    expect(catalog.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "available-plugin", status: "ready" }),
        expect.objectContaining({ id: "disabled-plugin", status: "disabled" }),
        expect.objectContaining({
          id: "missing-plugin",
          status: "unavailable",
        }),
      ]),
    );
    expect(catalog.pages).toEqual([
      expect.objectContaining({ id: "page", pluginId: "available-plugin" }),
    ]);
    await runtime.close();
  });

  test("isolates a plugin with a missing dependency from independent plugins", async () => {
    const dependent = definePlugin({
      metadata: {
        id: "dependent-plugin",
        name: "Dependent",
        version: "1.0.0",
        apiVersion: 1,
      },
      requires: ["missing-dependency"],
      configSchema: z.object({}),
      setup() {},
    });
    const independent = definePlugin({
      metadata: {
        id: "independent-plugin",
        name: "Independent",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.page({ id: "home", title: "Home" });
      },
    });
    const runtime = new PluginRuntime(noServices, async (specifier) =>
      specifier === "dependent"
        ? { default: dependent }
        : { default: independent },
    );

    await runtime.load({
      "dependent-plugin": source("dependent"),
      "independent-plugin": source("independent"),
    });

    const catalog = runtime.catalog();
    expect(catalog.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dependent-plugin",
          status: "unavailable",
        }),
        expect.objectContaining({
          id: "independent-plugin",
          status: "ready",
        }),
      ]),
    );
    expect(catalog.pages).toEqual([
      expect.objectContaining({ pluginId: "independent-plugin" }),
    ]);
    await runtime.close();
  });

  test("serves namespaced procedures with input validation and permission checks", async () => {
    const plugin = definePlugin({
      metadata: {
        id: "api-plugin",
        name: "API Plugin",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.procedure({
          id: "read",
          permission: "inspect",
          input: z.object({ value: z.number() }),
          output: z.number(),
          handler: (_context, input) => input.value * 2,
        });
        registry.procedure({
          id: "write",
          permission: "execute",
          input: z.object({}),
          handler: () => "done",
        });
      },
    });
    const runtime = new PluginRuntime(noServices, async () => ({
      default: plugin,
    }));
    await runtime.load({ "api-plugin": source("api-plugin") });
    const app = new Hono();
    app.use("/api/v1/*", async (context, next) => {
      context.set("principal", { id: "viewer", role: "viewer" });
      await next();
    });
    registerPluginRoutes(app, {
      runtime,
      audit: () => undefined,
    });

    const result = await app.request(
      "/api/v1/plugins/api-plugin/procedures/read",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 21 }),
      },
    );
    const invalid = await app.request(
      "/api/v1/plugins/api-plugin/procedures/read",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "21" }),
      },
    );
    const forbidden = await app.request(
      "/api/v1/plugins/api-plugin/procedures/write",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ data: 42 });
    expect(invalid.status).toBe(422);
    expect(forbidden.status).toBe(403);
    await runtime.close();
  });
});
