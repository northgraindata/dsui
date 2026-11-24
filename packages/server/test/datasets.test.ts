import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineAction, definePlugin, z } from "@northgraindata/dsui-plugin-sdk";
import { AdapterHostClient } from "../src/adapters/host";
import { RemoteBackend } from "../src/adapters/loader";
import type { LoadedAdapter } from "../src/adapters/types";
import { createRuntime } from "../src/app";
import catalogFixture from "./fixtures/catalog-adapter";
import datasetsFixture from "./fixtures/datasets-adapter";

const hostPath = new URL("../src/adapter-host.ts", import.meta.url).pathname;
const bundle = (name: string) =>
  new URL(`./fixtures/${name}.ts`, import.meta.url).pathname;

const hosts: AdapterHostClient[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.close()));
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function host(fixture: string) {
  const client = new AdapterHostClient({
    command: process.execPath,
    args: [hostPath, "--bundle", bundle(fixture)],
    timeoutMs: 10_000,
  });
  hosts.push(client);
  return client;
}

const memory = (mode: string) => ({ method: "memory", mode });

type Described = {
  connectionMethods: LoadedAdapter["connectionMethods"];
  capabilities: string[];
};

async function describeAdapter(client: AdapterHostClient) {
  return (await client.request({ method: "describe" })) as Described;
}

test("an adapter announces the datasets it can describe, and one that cannot announces nothing", async () => {
  expect(
    (await describeAdapter(host("datasets-adapter"))).capabilities,
  ).toEqual(["datasets"]);
  expect((await describeAdapter(host("catalog-adapter"))).capabilities).toEqual(
    [],
  );
});

test("datasets are paged and measured through the isolated host", async () => {
  const backend = new RemoteBackend(
    host("datasets-adapter"),
    "datasets-fixture",
    [{ id: "memory", requestConcurrency: "parallel", contextIdleTimeoutMs: 0 }],
  );
  const options = { timeoutMs: 10_000 };
  const first = await backend.listDatasets(memory("ok"), { limit: 2 }, options);
  expect(first.items.map((item) => item.ref.name)).toEqual([
    "public.customers",
    "public.orders",
  ]);
  expect(first.nextCursor).toBe("public.orders");
  const second = await backend.listDatasets(
    memory("ok"),
    { limit: 2, cursor: first.nextCursor },
    options,
  );
  expect(second.items.map((item) => item.ref.name)).toEqual([
    "public.payments",
  ]);
  expect(second.nextCursor).toBeUndefined();

  const observed = await backend.observeDatasets(
    memory("ok"),
    [{ name: "public.orders" }, { name: "public.dropped" }],
    options,
  );
  // A dataset that no longer exists is left out rather than failing the call.
  expect(observed).toEqual([
    {
      ref: { name: "public.orders" },
      at: "2026-11-19T10:00:00.000Z",
      rowCount: 100,
      rowCountExact: false,
      changeCounter: 7,
    },
  ]);
});

test("a malformed or failing adapter answer is an error, never data", async () => {
  const backend = new RemoteBackend(
    host("datasets-adapter"),
    "datasets-fixture",
    [{ id: "memory", requestConcurrency: "parallel", contextIdleTimeoutMs: 0 }],
  );
  const options = { timeoutMs: 10_000 };
  await expect(
    backend.observeDatasets(
      memory("invalid"),
      [{ name: "public.orders" }],
      options,
    ),
  ).rejects.toThrow();
  await expect(
    backend.listDatasets(memory("failing"), { limit: 10 }, options),
  ).rejects.toThrow("catalog is unreachable");
});

test("a read stops at the caller's timeout", async () => {
  const backend = new RemoteBackend(
    host("datasets-adapter"),
    "datasets-fixture",
    [{ id: "memory", requestConcurrency: "parallel", contextIdleTimeoutMs: 0 }],
  );
  const started = Date.now();
  await expect(
    backend.observeDatasets(memory("slow"), [{ name: "public.orders" }], {
      timeoutMs: 300,
    }),
  ).rejects.toThrow();
  expect(Date.now() - started).toBeLessThan(4_000);
});

async function runtimeWithConsumer(
  authorize: (serviceId: string | undefined) => boolean = () => true,
) {
  const directory = await mkdtemp(join(tmpdir(), "dsui-datasets-"));
  directories.push(directory);
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
        authenticate: () => ({ id: "tester", role: "operator" }),
      });
      registry.authorization({
        authorize: ({ resource }) =>
          authorize(resource?.type === "service" ? resource.id : undefined),
      });
    },
  });
  const consumer = definePlugin({
    metadata: {
      id: "consumer",
      name: "Consumer",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.action(
        defineAction({
          id: "read",
          input: z.object({ serviceId: z.string() }),
          permission: "inspect",
          run: async ({ serviceId }, context) => {
            const summary = await context.services.get(serviceId);
            const page = await context.services.datasets?.list(serviceId, {
              limit: 10,
            });
            const observed = await context.services.datasets?.observe(
              serviceId,
              [{ name: "public.orders" }],
            );
            return { summary, page, observed };
          },
        }),
      );
    },
  });
  const modules = new Map([
    ["security-test", security],
    ["consumer-test", consumer],
  ]);
  const runtime = createRuntime({
    dataDir: directory,
    config: {
      services: [
        {
          id: "warehouse",
          adapter: "datasets-fixture",
          name: "Warehouse",
          connection: memory("ok"),
        },
        {
          id: "secret",
          adapter: "datasets-fixture",
          name: "Secret",
          connection: memory("ok"),
        },
        {
          id: "plain",
          adapter: "catalog-fixture",
          name: "Plain",
          connection: { method: "api", url: "https://example.com" },
        },
      ],
      plugins: {
        security: {
          package: "security-test",
          enabled: true,
          critical: true,
          config: {},
        },
        consumer: { package: "consumer-test", enabled: true, config: {} },
      },
    },
    pluginModuleLoader: async (specifier) => ({
      default: modules.get(specifier),
    }),
  });
  // The registry is rebuilt from configuration on refresh, so register after it.
  await runtime.refreshConfig();
  for (const [id, fixture, name] of [
    ["datasets-fixture", datasetsFixture, "datasets-adapter"],
    ["catalog-fixture", catalogFixture, "catalog-adapter"],
  ] as const) {
    const client = host(name);
    const described = await describeAdapter(client);
    runtime.registry.register({
      id,
      metadata: fixture.metadata,
      connectionMethods: described.connectionMethods,
      catalog: {
        resources: [],
        actions: [],
        pages: [],
        components: [],
        jobs: [],
        signals: [],
        routes: [],
        capabilities: described.capabilities,
      },
      backend: new RemoteBackend(client, id, []),
    });
  }
  const call = (serviceId: string) =>
    runtime.app.request("/api/v1/plugins/consumer/procedures/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceId }),
    });
  return { runtime, call };
}

test("a plugin lists and measures datasets of a service it may inspect", async () => {
  const { runtime, call } = await runtimeWithConsumer();
  try {
    const response = await call("warehouse");
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    const { data } = body;
    expect(data.summary).toMatchObject({
      id: "warehouse",
      capabilities: ["datasets"],
    });
    expect(data.page.items).toHaveLength(3);
    expect(data.observed).toEqual([
      expect.objectContaining({
        ref: { name: "public.orders" },
        rowCount: 100,
      }),
    ]);
  } finally {
    await runtime.close();
  }
});

test("a service whose adapter does not describe datasets says so", async () => {
  const { runtime, call } = await runtimeWithConsumer();
  try {
    const response = await call("plain");
    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain(
      "does not describe datasets",
    );
  } finally {
    await runtime.close();
  }
});

test("datasets of a service the caller may not inspect are not readable", async () => {
  const { runtime, call } = await runtimeWithConsumer(
    (serviceId) => serviceId !== "secret",
  );
  try {
    expect((await call("warehouse")).status).toBe(200);
    const denied = await call("secret");
    // The service is invisible to the caller, so the read yields nothing.
    expect(denied.status).toBe(200);
    const { data } = await denied.json();
    expect(data.summary).toBeNull();
    expect(data.page).toBeNull();
    expect(data.observed).toBeNull();
  } finally {
    await runtime.close();
  }
});
