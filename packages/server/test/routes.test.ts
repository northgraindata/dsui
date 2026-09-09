import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntime } from "../src/app";

const masterKey = Buffer.alloc(32, 9).toString("base64");
const fixturePackage = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "mini-adapter-source.ts",
);

function runtimeWithFixture() {
  return createRuntime({
    databasePath: ":memory:",
    authMode: "none",
    masterKey,
    config: {
      services: [],
      adapters: { fixture: { package: fixturePackage } },
    },
  });
}

function serviceInput() {
  return {
    adapter: "fixture",
    name: "Fixture test",
    connection: {},
  };
}

describe("services API", () => {
  it("lists only loaded adapters with machine-readable catalogs", async () => {
    const runtime = runtimeWithFixture();
    try {
      await runtime.refreshConfig();
      const response = await runtime.app.request("/api/v1/adapters");
      expect(response.status).toBe(200);
      const adapters = (await response.json()) as Array<{
        id: string;
        status: string;
        resources: Array<{ id: string }>;
        actions: Array<{ id: string }>;
        pages: Array<{ path: string }>;
      }>;
      expect(adapters.map((adapter) => adapter.id)).toEqual(["fixture"]);
      expect(adapters[0]?.status).toBe("ok");
      expect(adapters[0]?.resources.map((resource) => resource.id)).toEqual([
        "things",
      ]);
      expect(adapters[0]?.actions.map((action) => action.id)).toEqual([
        "refresh",
      ]);
      expect(adapters[0]?.pages).toEqual([{ path: "/things" }]);
    } finally {
      runtime.close();
    }
  });

  it("includes bundled adapters when nothing is configured", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      authMode: "none",
      masterKey,
    });
    try {
      await runtime.refreshConfig();
      const response = await runtime.app.request("/api/v1/adapters");
      expect(response.status).toBe(200);
      const adapters = (await response.json()) as Array<{
        id: string;
        status: string;
      }>;
      expect(adapters.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: "duckdb", status: "ok" },
        { id: "snowflake", status: "ok" },
      ]);

      const created = await runtime.app.request("/api/v1/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          adapter: "duckdb",
          name: "DuckDB preview",
          connection: { method: "memory" },
        }),
      });
      expect(created.status).toBe(201);
      const service = (await created.json()) as { id: string; health: string };
      expect(service.health).toBe("healthy");

      const pages = await runtime.app.request(
        `/api/v1/services/${service.id}/pages`,
      );
      expect(pages.status).toBe(200);
      const pageList = (await pages.json()) as {
        pages: Array<{ path: string }>;
      };
      expect(pageList.pages.map((page) => page.path)).toContain("/query");
    } finally {
      runtime.close();
    }
  });

  it("creates, lists, probes, executes, and deletes a service", async () => {
    const runtime = runtimeWithFixture();
    try {
      const created = await runtime.app.request("/api/v1/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serviceInput()),
      });
      expect(created.status).toBe(201);
      const service = (await created.json()) as {
        id: string;
        adapter: string;
        health: string;
        resources: string[];
      };
      expect(service.adapter).toBe("fixture");
      expect(service.health).toBe("healthy");
      expect(service.resources).toEqual(["things"]);

      const listed = await runtime.app.request("/api/v1/services");
      expect(listed.status).toBe(200);
      expect(await listed.json()).toHaveLength(1);

      const resources = await runtime.app.request(
        `/api/v1/services/${service.id}/resources/things`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(resources.status).toBe(200);
      expect(await resources.json()).toEqual({
        data: [{ name: "alpha" }, { name: "beta" }],
      });

      const acted = await runtime.app.request(
        `/api/v1/services/${service.id}/actions/refresh`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(acted.status).toBe(200);
      expect(await acted.json()).toEqual({
        status: "success",
        data: "refreshed",
      });

      const pages = await runtime.app.request(
        `/api/v1/services/${service.id}/pages`,
      );
      expect(pages.status).toBe(200);
      expect(await pages.json()).toEqual({
        pages: [{ path: "/things" }],
      });

      const page = await runtime.app.request(
        `/api/v1/services/${service.id}/page?path=%2Fthings`,
      );
      expect(page.status).toBe(200);
      expect(await page.json()).toEqual({
        path: "/things",
        nodes: [
          { kind: "page-header", props: { title: "Things" } },
          {
            kind: "table",
            props: { source: { resourceId: "things" } },
          },
        ],
      });

      const deleted = await runtime.app.request(
        `/api/v1/services/${service.id}`,
        { method: "DELETE" },
      );
      expect(deleted.status).toBe(204);
      const relisted = await runtime.app.request("/api/v1/services");
      expect(await relisted.json()).toHaveLength(0);
    } finally {
      runtime.close();
    }
  });

  it("rejects unknown adapters, resources, and actions with clear errors", async () => {
    const runtime = runtimeWithFixture();
    try {
      const created = await runtime.app.request("/api/v1/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serviceInput()),
      });
      const service = (await created.json()) as { id: string };
      const unknownResource = await runtime.app.request(
        `/api/v1/services/${service.id}/resources/missing`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(unknownResource.status).toBe(502);
      const unknownAction = await runtime.app.request(
        `/api/v1/services/${service.id}/actions/missing`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(unknownAction.status).toBe(502);
      const missingService = await runtime.app.request(
        "/api/v1/services/missing/resources/things",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(missingService.status).toBe(404);
      const badAdapter = await runtime.app.request("/api/v1/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          adapter: "kafka",
          name: "x",
          connection: {},
        }),
      });
      expect(badAdapter.status).toBe(404);
      const legacy = await runtime.app.request(
        `/api/v1/services/${service.id}/capabilities/query`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(legacy.status).toBe(404);
    } finally {
      runtime.close();
    }
  });

  it("requires encrypted storage for UI services", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      authMode: "none",
      config: {
        services: [],
        adapters: { fixture: { package: fixturePackage } },
      },
    });
    try {
      const created = await runtime.app.request("/api/v1/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serviceInput()),
      });
      expect(created.status).not.toBe(201);
    } finally {
      runtime.close();
    }
  });
});
