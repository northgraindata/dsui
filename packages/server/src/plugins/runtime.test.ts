import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { definePlugin, PageHeader } from "@northgraindata/dsui-plugin-sdk";
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
  test("loads a pinned GitHub plugin only after verifying its manifest and bundles", async () => {
    const plugin = definePlugin({
      metadata: {
        id: "remote-plugin",
        name: "Remote",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.page({
          id: "home",
          title: "Remote",
          render: () => PageHeader({ title: "Remote" }),
        });
      },
    });
    const server = "export default {};";
    const browser = "export function createComponents() { return {}; }";
    const hash = (value: string, algorithm: "sha256" | "sha512") =>
      createHash(algorithm)
        .update(value)
        .digest(algorithm === "sha256" ? "hex" : "base64");
    const manifest = JSON.stringify({
      id: "remote-plugin",
      version: "1.0.0",
      apiVersion: 1,
      server: {
        entry: "./dist/plugin.mjs",
        sha256: hash(server, "sha256"),
        bytes: server.length,
      },
      browser: {
        entry: "./dist/browser.mjs",
        sha256: hash(browser, "sha256"),
        bytes: browser.length,
      },
    });
    const files = new Map([
      ["plugin.json", manifest],
      ["dist/plugin.mjs", server],
      ["dist/browser.mjs", browser],
    ]);
    const dataDir = mkdtempSync(join(tmpdir(), "dsui-plugin-runtime-"));
    const imported: string[] = [];
    const runtime = new PluginRuntime(
      noServices,
      async (specifier) => {
        imported.push(specifier);
        return { default: plugin };
      },
      {
        dataDir,
        fetch: async (url) => {
          const entry = new URL(url).pathname.split(`/${"a".repeat(40)}/`)[1];
          const bytes = files.get(entry ?? "");
          return new Response(bytes ?? "", { status: bytes ? 200 : 404 });
        },
      },
    );
    try {
      await runtime.load({
        "remote-plugin": {
          source: "git",
          repository: "git+https://github.com/acme/remote-plugin",
          commit: "a".repeat(40),
          integrity: `sha512-${hash(manifest, "sha512")}`,
          enabled: true,
          config: {},
        },
      });
      expect(runtime.catalog().plugins).toMatchObject([
        { id: "remote-plugin", status: "ready" },
      ]);
      expect(imported).toHaveLength(1);
      expect(imported[0]).toEndWith("/server.mjs");
      expect(runtime.browserBundle("remote-plugin")?.path).toEndWith(
        "/browser.mjs",
      );
    } finally {
      await runtime.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

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
        registry.page({
          id: "home",
          title: config.label ?? "Base page",
          render: () => PageHeader({ title: config.label ?? "Base page" }),
        });
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
        registry.page({
          id: "page",
          title: "Page",
          render: () => PageHeader({ title: "Page" }),
        });
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
    expect(runtime.procedure("disabled-plugin", "read")).toBeNull();
    expect(await runtime.renderPage("disabled-plugin", "page")).toBeNull();
    expect(runtime.browserBundle("disabled-plugin")).toBeUndefined();
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
        registry.page({
          id: "home",
          title: "Home",
          render: () => PageHeader({ title: "Home" }),
        });
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

  test("fails closed when a critical security plugin cannot load", async () => {
    const runtime = new PluginRuntime(noServices, async () => {
      throw new Error("secret from dependency");
    });
    await expect(
      runtime.load({ security: { ...source("security"), critical: true } }),
    ).rejects.toThrow("Security plugin");
    expect(runtime.hasAuthentication()).toBe(true);
    expect(
      await runtime.authenticate(
        new Request("http://localhost/api/v1/services"),
      ),
    ).toBeNull();
    expect(
      await runtime.authorize({ id: "local", role: "owner" }, "manage"),
    ).toBe(false);
    await runtime.close();
  });

  test("loads built-in plugins without any configuration entry", async () => {
    const builtIns = { "example-plugin": source("example-plugin") };
    const builtIn = definePlugin({
      metadata: {
        id: "example-plugin",
        name: "Example",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.page({
          id: "home",
          title: "Home",
          render: () => PageHeader({ title: "Home" }),
        });
      },
    });
    const runtime = new PluginRuntime(noServices, async () => ({
      default: builtIn,
    }));

    await runtime.load({}, builtIns, new Set(Object.keys(builtIns)));

    expect(runtime.catalog().plugins).toEqual([
      expect.objectContaining({ id: "example-plugin", status: "ready" }),
    ]);
    await runtime.close();
  });

  test("cannot disable a built-in plugin through configuration", async () => {
    const builtIn = definePlugin({
      metadata: {
        id: "example-plugin",
        name: "Example",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup() {},
    });
    const builtIns = { "example-plugin": source("example-plugin") };
    const runtime = new PluginRuntime(noServices, async () => ({
      default: builtIn,
    }));

    await runtime.load(
      { "example-plugin": source("substitute", false) },
      builtIns,
      new Set(Object.keys(builtIns)),
    );

    expect(runtime.catalog().plugins).toEqual([
      expect.objectContaining({ id: "example-plugin", status: "ready" }),
    ]);
    await runtime.close();
  });

  test("ignores a configuration entry that shadows a shipped built-in plugin", async () => {
    const builtIns = { "example-plugin": source("example-plugin") };
    const runtime = new PluginRuntime(noServices, async () => ({
      default: definePlugin({
        metadata: {
          id: "example-plugin",
          name: "Example",
          version: "1.0.0",
          apiVersion: 1,
        },
        configSchema: z.object({}),
        setup() {},
      }),
    }));

    await runtime.load(
      { "example-plugin": source("attacker-package") },
      builtIns,
      new Set(Object.keys(builtIns)),
    );

    expect(runtime.catalog().plugins).toEqual([
      expect.objectContaining({ id: "example-plugin", status: "ready" }),
    ]);
    await runtime.close();
  });

  test("reports a reserved built-in id as unavailable when it is not shipped", async () => {
    const runtime = new PluginRuntime(noServices, async () => ({}));

    await runtime.load(
      { "example-plugin": source("attacker-package") },
      {},
      new Set(["example-plugin"]),
    );

    expect(runtime.catalog().plugins).toEqual([
      expect.objectContaining({
        id: "example-plugin",
        status: "unavailable",
        detail:
          '"example-plugin" is a reserved built-in plugin id and is not configurable',
      }),
    ]);
    await runtime.close();
  });

  test("rejects conflicting authentication providers", async () => {
    const makeSecurity = (id: string) =>
      definePlugin({
        metadata: {
          id,
          name: id,
          version: "1.0.0",
          apiVersion: 1,
          security: true,
        },
        configSchema: z.object({}),
        setup(registry) {
          registry.authentication({
            authenticate: () => ({ id: "user", role: "viewer" }),
          });
        },
      });
    const runtime = new PluginRuntime(noServices, async (id) => ({
      default: makeSecurity(id),
    }));
    await expect(
      runtime.load({
        first: { ...source("first"), critical: true },
        second: { ...source("second"), critical: true },
      }),
    ).rejects.toThrow("only one authentication");
    expect(runtime.hasAuthentication()).toBe(true);
    await runtime.close();
  });
});
