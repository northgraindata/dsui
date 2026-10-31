import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdapterHostClient } from "../src/adapters/host";
import { RemoteBackend } from "../src/adapters/loader";
import { createRuntime } from "../src/app";

const TOKEN = "d".repeat(40);
let directory: string;
let runtime: ReturnType<typeof createRuntime>;
let host: AdapterHostClient;

const put = (name: string, body: string, token = TOKEN) =>
  runtime.app.request(
    `http://dsui.test/adapters/v1/services/dbt/artifacts/${name}`,
    { method: "PUT", body, headers: { authorization: `Bearer ${token}` } },
  );

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "dsui-dbt-push-"));
  const configPath = join(directory, "dsui.yaml");
  await writeFile(
    configPath,
    JSON.stringify({
      services: [
        {
          id: "dbt",
          adapter: "dbt",
          connection: { method: "push", pushToken: TOKEN },
        },
      ],
    }),
  );
  runtime = createRuntime({ configPath, dataDir: directory });
  host = new AdapterHostClient({
    command: process.execPath,
    args: [
      new URL("../src/adapter-host.ts", import.meta.url).pathname,
      "--bundle",
      new URL("../../adapter-dbt/src/adapter.ts", import.meta.url).pathname,
      "--database",
      join(directory, "dsui.sqlite"),
      "--blobs",
      join(directory, "blobs"),
    ],
    timeoutMs: 20_000,
  });
  const described = (await host.request({ method: "describe" })) as {
    routes: never[];
    signals: never[];
  };
  await runtime.refreshConfig();
  runtime.registry.register({
    id: "dbt",
    metadata: { id: "dbt", name: "dbt", version: "0.1.0" },
    catalog: {
      resources: [],
      actions: [],
      pages: [],
      components: [],
      jobs: [],
      signals: described.signals,
      routes: described.routes,
    },
    backend: new RemoteBackend(host, "dbt", []),
  });
});

afterAll(async () => {
  await host.close();
  await rm(directory, { recursive: true, force: true });
});

test("CI pushes a large manifest and the service reads it back", async () => {
  const nodes = Object.fromEntries(
    Array.from({ length: 40_000 }, (_, index) => [
      `model.p.m${index}`,
      { resource_type: "model", description: "x".repeat(100) },
    ]),
  );
  const body = JSON.stringify({ metadata: {}, nodes });
  expect(body.length).toBeGreaterThan(4 * 1024 * 1024);

  const response = await put("manifest.json", body);
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({
    name: "manifest.json",
    size: body.length,
  });

  const read = await runtime.app.request(
    "http://dsui.test/api/v1/services/dbt/resources/dashboard",
    { method: "POST", body: "{}" },
  );
  expect(read.status).toBe(200);
  expect(
    ((await read.json()) as { data: { models: number } }).data.models,
  ).toBe(40_000);
});

test("a wrong token stores nothing", async () => {
  expect((await put("catalog.json", "{}", "x".repeat(40))).status).toBe(401);
});
