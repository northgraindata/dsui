import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "../app";

const runtimes: Array<Awaited<ReturnType<typeof createRuntime>>> = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("plugin server integration", () => {
  test("loads an enabled plugin from config and serves its catalog and procedure", async () => {
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
          "example-plugin": {
            package: "@northgraindata/dsui-plugin-example",
            enabled: true,
            config: { greeting: "Hi" },
          },
        },
      },
    });
    runtimes.push(runtime);

    await runtime.refreshConfig();
    const catalogResponse = await runtime.app.request("/api/v1/plugins");
    const procedureResponse = await runtime.app.request(
      "/api/v1/plugins/example-plugin/procedures/greet",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "DSUI" }),
      },
    );
    const servicesResponse = await runtime.app.request(
      "/api/v1/plugins/example-plugin/procedures/list-services",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 2 }),
      },
    );
    const nextServicesResponse = await runtime.app.request(
      "/api/v1/plugins/example-plugin/procedures/list-services",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cursor: "dbt-prod", limit: 2 }),
      },
    );

    expect(catalogResponse.status).toBe(200);
    expect(await catalogResponse.json()).toMatchObject({
      plugins: [{ id: "example-plugin", status: "ready" }],
      pages: [{ id: "overview", pluginId: "example-plugin" }],
      navigation: [{ id: "overview-link", pluginId: "example-plugin" }],
      slots: [
        {
          id: "service-card-status",
          slot: "dashboard.service-card.trailing",
          pluginId: "example-plugin",
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
  });
});
