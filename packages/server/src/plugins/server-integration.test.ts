import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Card,
  defineComponent,
  definePlugin,
  Grid,
  Section,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import { createRuntime } from "../app";

const runtimes: Array<Awaited<ReturnType<typeof createRuntime>>> = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("plugin server integration", () => {
  test("starts without optional plugins and leaves plugin routes unavailable", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      masterKey: Buffer.alloc(32, 9).toString("base64"),
      config: { services: [], adapters: {} },
    });
    runtimes.push(runtime);
    await runtime.refreshConfig();
    const catalog = await runtime.app.request("/api/v1/plugins");
    expect(await catalog.json()).toEqual({
      plugins: [],
      pages: [],
      navigation: [],
      slots: [],
    });
    const missing = await runtime.app.request(
      "/api/v1/plugins/missing/pages/home",
    );
    expect(missing.status).toBe(404);
    const slots = await runtime.app.request(
      "/api/v1/plugins/slots/dashboard.service-card.trailing",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceIds: ["unknown"] }),
      },
    );
    expect(await slots.json()).toEqual({ items: [] });
  });

  test("loads an enabled plugin from config and serves its catalog and procedure", async () => {
    const plugin = definePlugin({
      metadata: {
        id: "custom-plugin",
        name: "Custom plugin",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({ greeting: z.string().default("Hello") }),
      setup(registry) {
        registry.page({
          id: "overview",
          title: "Plugin example",
          render: async ({ context }) => {
            const { items } = await context.services.list({ limit: 12 });
            return [
              Section({
                title: "Connected services",
                content: Grid({
                  columns: 2,
                  content: items.map((service) =>
                    Card({
                      title: service.name,
                      description: service.adapter,
                      content: defineComponent<{
                        name: string;
                        adapter: string;
                      }>({
                        id: "custom-plugin/service-summary",
                        path: "./browser.mjs",
                        props: z.object({
                          name: z.string(),
                          adapter: z.string(),
                        }),
                      })({ name: service.name, adapter: service.adapter }),
                    }),
                  ),
                }),
              }),
            ];
          },
        });
        registry.navigation({
          id: "overview-link",
          area: "primary",
          label: "Plugin example",
          pageId: "overview",
          order: 100,
        });
        registry.slot({
          id: "service-card-status",
          slot: "dashboard.service-card.trailing",
          order: 100,
          render: ({ service }) =>
            defineComponent<{ name: string; adapter: string }>({
              id: "custom-plugin/service-summary",
              path: "./browser.mjs",
              props: z.object({ name: z.string(), adapter: z.string() }),
            })({ name: service.name, adapter: service.adapter }),
        });
        registry.slot({
          id: "workspace-summary",
          slot: "service.workspace.after-header",
          order: 100,
          render: ({ service }) =>
            Card({
              title: "Plugin extension",
              content: Section({
                title: service.name,
                content: Grid({ columns: 1, content: [] }),
              }),
            }),
        });
        registry.procedure({
          id: "list-services",
          permission: "inspect",
          input: z.object({
            cursor: z.string().optional(),
            limit: z.number().int().positive().max(100).optional(),
          }),
          output: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                adapter: z.string(),
                managedBy: z.enum(["configuration", "ui"]),
              }),
            ),
            nextCursor: z.string().optional(),
          }),
          handler: (context, input) => context.services.list(input),
        });
        registry.procedure({
          id: "greet",
          permission: "inspect",
          input: z.object({ name: z.string().min(1) }),
          output: z.string(),
          handler: (context, input) =>
            `${context.config.greeting}, ${input.name}`,
        });
      },
    });
    const bundleRoot = mkdtempSync(join(tmpdir(), "dsui-plugin-bundle-"));
    temporaryDirectories.push(bundleRoot);
    writeFileSync(
      join(bundleRoot, "custom-plugin.browser.mjs"),
      "export function createComponents(React) { return {}; }",
    );
    const webRoot = mkdtempSync(join(tmpdir(), "dsui-plugin-web-"));
    temporaryDirectories.push(webRoot);
    writeFileSync(join(webRoot, "index.html"), "<!doctype html>");
    const runtime = createRuntime({
      databasePath: ":memory:",
      webRoot,
      masterKey: Buffer.alloc(32, 9).toString("base64"),
      config: {
        services: [
          {
            id: "postgres-prod",
            name: "Postgres",
            adapter: "postgresql",
            connection: { password: "must-not-leak" },
          },
          {
            id: "dbt-prod",
            name: "dbt",
            adapter: "dbt",
            connection: { token: "also-private" },
          },
          {
            id: "airflow-prod",
            name: "Airflow",
            adapter: "airflow",
            connection: {},
          },
        ],
        adapters: {},
        plugins: {
          "custom-plugin": {
            package: "@acme/custom-plugin",
            browserBundle: join(bundleRoot, "custom-plugin.browser.mjs"),
            enabled: true,
            config: { greeting: "Hi" },
          },
        },
      },
      pluginModuleLoader: async (specifier) => {
        if (specifier === "@acme/custom-plugin") return { default: plugin };
        throw new Error(`Unexpected module ${specifier}`);
      },
    });
    runtimes.push(runtime);

    await runtime.refreshConfig();
    const catalogResponse = await runtime.app.request("/api/v1/plugins");
    const procedureResponse = await runtime.app.request(
      "/api/v1/plugins/custom-plugin/procedures/greet",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "DSUI" }),
      },
    );
    const servicesResponse = await runtime.app.request(
      "/api/v1/plugins/custom-plugin/procedures/list-services",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 2 }),
      },
    );
    const pageResponse = await runtime.app.request(
      "/api/v1/plugins/custom-plugin/pages/overview",
    );
    const bundleResponse = await runtime.app.request(
      "/api/v1/plugins/custom-plugin/components.mjs",
    );
    const slotResponse = await runtime.app.request(
      "/api/v1/plugins/slots/dashboard.service-card.trailing",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceIds: ["dbt-prod"] }),
      },
    );
    const workspaceSlotResponse = await runtime.app.request(
      "/api/v1/plugins/slots/service.workspace.after-header",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceIds: ["dbt-prod"] }),
      },
    );
    const missingPage = await runtime.app.request(
      "/api/v1/plugins/custom-plugin/pages/unknown",
    );
    const nextServicesResponse = await runtime.app.request(
      "/api/v1/plugins/custom-plugin/procedures/list-services",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cursor: "dbt-prod", limit: 2 }),
      },
    );

    expect(catalogResponse.status).toBe(200);
    expect(await catalogResponse.json()).toMatchObject({
      plugins: [{ id: "custom-plugin", status: "ready" }],
      pages: [{ id: "overview", pluginId: "custom-plugin" }],
      navigation: [{ id: "overview-link", pluginId: "custom-plugin" }],
      slots: [
        {
          id: "service-card-status",
          slot: "dashboard.service-card.trailing",
          pluginId: "custom-plugin",
        },
        {
          id: "workspace-summary",
          slot: "service.workspace.after-header",
          pluginId: "custom-plugin",
        },
      ],
    });
    expect(procedureResponse.status).toBe(200);
    expect(await procedureResponse.json()).toEqual({ data: "Hi, DSUI" });
    expect(servicesResponse.status).toBe(200);
    const serviceResult = await servicesResponse.json();
    expect(serviceResult).toEqual({
      data: {
        items: [
          {
            id: "airflow-prod",
            name: "Airflow",
            adapter: "airflow",
            managedBy: "configuration",
          },
          {
            id: "dbt-prod",
            name: "dbt",
            adapter: "dbt",
            managedBy: "configuration",
          },
        ],
        nextCursor: "dbt-prod",
      },
    });
    expect(JSON.stringify(serviceResult)).not.toContain("must-not-leak");
    expect(JSON.stringify(serviceResult)).not.toContain("also-private");
    expect(nextServicesResponse.status).toBe(200);
    expect(await nextServicesResponse.json()).toEqual({
      data: {
        items: [
          {
            id: "postgres-prod",
            name: "Postgres",
            adapter: "postgresql",
            managedBy: "configuration",
          },
        ],
      },
    });
    expect(pageResponse.status).toBe(200);
    const page = await pageResponse.json();
    expect(page.path).toBe("/overview");
    expect(page.nodes[0].kind).toBe("section");
    expect(JSON.stringify(page)).not.toContain("must-not-leak");
    expect(JSON.stringify(page)).not.toContain("also-private");
    expect(JSON.stringify(page)).toContain(
      "/api/v1/plugins/custom-plugin/components.mjs",
    );
    expect(bundleResponse.status).toBe(200);
    expect(await bundleResponse.text()).toContain("createComponents");
    expect(slotResponse.status).toBe(200);
    expect(await slotResponse.json()).toMatchObject({
      items: [
        {
          serviceId: "dbt-prod",
          pluginId: "custom-plugin",
          slotId: "service-card-status",
          nodes: [{ kind: "custom" }],
        },
      ],
    });
    expect(workspaceSlotResponse.status).toBe(200);
    expect(await workspaceSlotResponse.json()).toMatchObject({
      items: [
        {
          serviceId: "dbt-prod",
          pluginId: "custom-plugin",
          slotId: "workspace-summary",
          nodes: [{ kind: "card" }],
        },
      ],
    });
    expect(missingPage.status).toBe(404);
  });

  test("an authentication/authorization plugin applies to core and plugin endpoints", async () => {
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
          authenticate: (request) =>
            request.headers.get("x-demo-user") === "viewer"
              ? { id: "viewer", role: "viewer" }
              : null,
        });
        registry.authorization({
          authorize: ({ resource }) =>
            resource?.type !== "service" || resource.id !== "private-service",
        });
        registry.procedure({
          id: "services",
          permission: "inspect",
          input: z.object({}),
          handler: ({ services }) => services.list(),
        });
      },
    });
    const runtime = createRuntime({
      databasePath: ":memory:",
      masterKey: Buffer.alloc(32, 9).toString("base64"),
      config: {
        adapters: {},
        services: [
          {
            id: "private-service",
            name: "Private",
            adapter: "dbt",
            connection: {},
          },
          {
            id: "public-service",
            name: "Public",
            adapter: "dbt",
            connection: {},
          },
        ],
        plugins: {
          security: {
            package: "security",
            enabled: true,
            critical: true,
            config: {},
          },
        },
      },
      pluginModuleLoader: async () => ({ default: security }),
    });
    runtimes.push(runtime);
    await runtime.refreshConfig();
    const blocked = await runtime.app.request("/api/v1/plugins");
    expect(blocked.status).toBe(401);
    const headers = {
      "x-demo-user": "viewer",
      "content-type": "application/json",
    };
    const visible = await runtime.app.request("/api/v1/services", { headers });
    expect(visible.status).toBe(200);
    expect(
      (await visible.json()).map((service: { id: string }) => service.id),
    ).toEqual(["public-service"]);
    const forbidden = await runtime.app.request(
      "/api/v1/services/private-service/pages",
      { headers },
    );
    expect(forbidden.status).toBe(403);
    const pluginList = await runtime.app.request(
      "/api/v1/plugins/security/procedures/services",
      {
        method: "POST",
        headers,
        body: "{}",
      },
    );
    expect(pluginList.status).toBe(200);
    expect(
      (await pluginList.json()).data.items.map(
        (service: { id: string }) => service.id,
      ),
    ).toEqual(["public-service"]);
  });
});
