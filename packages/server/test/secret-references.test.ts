import { afterEach, beforeEach, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { definePlugin, z } from "@northgraindata/dsui-plugin-sdk";
import type { AdapterBackend } from "../src/adapters/types";
import { createRuntime } from "../src/app";
import { ConnectionCipher } from "../src/db/crypto";
import { DsuiDatabase } from "../src/db/database";

const PASSWORD = "from-the-secret-manager";
const reference = (name: string) => ({
  $secret: { provider: "fake-secrets", reference: name },
});

let directory: string;
let runtime: ReturnType<typeof createRuntime> | undefined;
let reads: string[];
let searches: string[];
let seen: unknown[];
const masterKey = randomBytes(32).toString("base64");

const secretsPlugin = () =>
  definePlugin({
    metadata: {
      id: "fake-secrets",
      name: "Fake secrets",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.secrets({
        id: "fake-secrets",
        label: "Fake secrets",
        reference: { label: "Secret name", placeholder: "db/password" },
        search: async (query) => {
          searches.push(query);
          if (query === "denied") throw new Error("AccessDenied");
          return [
            { reference: "db/password", description: "Warehouse login" },
            { reference: "db/token" },
          ].filter((item) => item.reference.startsWith(query));
        },
        resolve: async (name) => {
          reads.push(name);
          if (name === "missing") throw new Error("not found");
          return PASSWORD;
        },
      });
    },
  });

async function start(services: unknown[] = []) {
  runtime = createRuntime({
    dataDir: directory,
    masterKey,
    config: {
      services: services as never,
      plugins: {
        "fake-secrets": { package: "fake-secrets", enabled: true, config: {} },
      },
    },
    pluginModuleLoader: async () => ({ default: secretsPlugin() }),
  });
  await runtime.refreshConfig();
  const backend = {
    validateConnection: (connection: unknown) => ({
      ...(connection as object),
      defaulted: true,
    }),
    checkHealth: async (connection: unknown) => {
      seen.push(connection);
      return { status: "healthy" as const };
    },
  } as unknown as AdapterBackend;
  runtime.registry.register({
    id: "fake-db",
    metadata: { id: "fake-db", name: "Fake DB", version: "1.0.0" },
    catalog: {
      resources: [],
      actions: [],
      pages: [],
      components: [],
      jobs: [],
      signals: [],
      routes: [],
    },
    backend,
  });
  return runtime;
}

const post = (path: string, body: unknown) =>
  runtime!.app.request(`http://dsui.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "dsui-secret-refs-"));
  reads = [];
  searches = [];
  seen = [];
});

afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
  await rm(directory, { recursive: true, force: true });
});

test("lists the providers plugins offer", async () => {
  await start();
  const response = await runtime!.app.request(
    "http://dsui.test/api/v1/secret-providers",
  );
  expect(await response.json()).toEqual([
    {
      id: "fake-secrets",
      label: "Fake secrets",
      reference: { label: "Secret name", placeholder: "db/password" },
      searchable: true,
    },
  ]);
});

test("a connection test reads the secret before the adapter sees it", async () => {
  await start();
  const response = await post("/api/v1/services/test", {
    adapter: "fake-db",
    name: "Warehouse",
    connection: { host: "db", password: reference("db/password") },
  });
  expect(response.status).toBe(200);
  expect(seen).toEqual([{ host: "db", password: PASSWORD, defaulted: true }]);
});

test("a saved service keeps the reference and never the credential", async () => {
  await start();
  const response = await post("/api/v1/services", {
    adapter: "fake-db",
    name: "Warehouse",
    connection: { host: "db", password: reference("db/password") },
  });
  expect(response.status).toBe(201);
  // The adapter was called with the real value...
  expect(seen.at(-1)).toMatchObject({ password: PASSWORD });

  const database = new DsuiDatabase(join(directory, "dsui.sqlite"));
  try {
    const [row] = database.listUiServices();
    const stored = new ConnectionCipher(masterKey).decrypt<
      Record<string, unknown>
    >({
      ciphertext: row!.connection_ciphertext,
      iv: row!.connection_iv,
      tag: row!.connection_tag,
    });
    // ...but what was stored is the reference, with the adapter's defaults.
    expect(stored).toEqual({
      host: "db",
      password: reference("db/password"),
      defaulted: true,
    });
    expect(JSON.stringify(stored)).not.toContain(PASSWORD);
  } finally {
    database.close();
  }
});

test("a service from the configuration file resolves its reference", async () => {
  await start([
    {
      id: "warehouse",
      adapter: "fake-db",
      connection: { password: reference("db/password") },
    },
  ]);
  const response = await runtime!.app.request(
    "http://dsui.test/api/v1/services",
  );
  expect(response.status).toBe(200);
  expect(seen).toEqual([{ password: PASSWORD }]);
});

test("an unreadable secret is reported without saving anything", async () => {
  await start();
  const response = await post("/api/v1/services", {
    adapter: "fake-db",
    name: "Warehouse",
    connection: { password: reference("missing") },
  });
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(((await response.json()) as { message: string }).message).toBe(
    'Could not read "missing" from Fake secrets: not found',
  );
  const database = new DsuiDatabase(join(directory, "dsui.sqlite"));
  try {
    expect(database.listUiServices()).toHaveLength(0);
  } finally {
    database.close();
  }
});

test("a reference to a provider that is not installed says so", async () => {
  await start();
  const response = await post("/api/v1/services/test", {
    adapter: "fake-db",
    name: "Warehouse",
    connection: { password: { $secret: { provider: "nope", reference: "x" } } },
  });
  expect(((await response.json()) as { message: string }).message).toBe(
    'Secret provider "nope" is not installed',
  );
});

const suggestions = (query: string, provider = "fake-secrets") =>
  runtime!.app.request(
    `http://dsui.test/api/v1/secret-providers/${provider}/suggestions?q=${encodeURIComponent(query)}`,
  );

test("suggests secrets whose name matches what was typed", async () => {
  await start();
  const response = await suggestions("db/p");
  expect(await response.json()).toEqual({
    available: true,
    items: [{ reference: "db/password", description: "Warehouse login" }],
  });
});

test("a provider that cannot list falls back, and is not asked again", async () => {
  await start();
  for (const query of ["denied", "denied", "db/"]) {
    const response = await suggestions(query);
    expect(await response.json()).toEqual({ available: false, items: [] });
  }
  expect(searches).toEqual(["denied"]);
});

test("suggestions from an unknown provider are a 404", async () => {
  await start();
  expect((await suggestions("x", "nope")).status).toBe(404);
});
