import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginPrincipal } from "@northgraindata/dsui-plugin-sdk";
import { defineAction, definePlugin, z } from "@northgraindata/dsui-plugin-sdk";
import type { AdapterBackend } from "../src/adapters/types";
import { createRuntime } from "../src/app";

let root: string;
let runtime: ReturnType<typeof createRuntime>;
let principal: PluginPrincipal | null;
let outcome: "success" | "error" | "throw";
let emits: boolean;

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
    registry.authentication({ authenticate: () => principal });
  },
});

const emitter = definePlugin({
  metadata: { id: "emitter", name: "Emitter", version: "1.0.0", apiVersion: 1 },
  configSchema: z.object({}),
  setup(registry) {
    registry.signal({ id: "noted", payload: z.object({ ok: z.boolean() }) });
    registry.action(
      defineAction({
        id: "note",
        input: z.object({}),
        permission: "inspect",
        run: async (_input, context) => {
          await context.events.emit("noted", { ok: true });
          return { ok: true };
        },
      }),
    );
  },
});

const unsupported = () => Promise.reject(new Error("not used in this test"));
const backend: AdapterBackend = {
  validateConnection: (connection) => connection,
  checkHealth: () =>
    Promise.resolve({
      status: "healthy",
      score: 100,
      checks: [],
      checkedAt: new Date().toISOString(),
    }),
  renderPage: unsupported,
  executeResource: unsupported,
  executeJob: unsupported,
  executeRoute: unsupported,
  executeAction: async () => {
    if (outcome === "throw") throw new Error("connection refused");
    return {
      result:
        outcome === "success"
          ? { status: "success", data: { runId: "run-1" } }
          : { status: "error", message: "DAG is paused" },
      emissions: emits
        ? [{ signalId: "run-started", payload: { runId: "run-1" } }]
        : [],
    };
  },
};

async function start(withSecurity: boolean) {
  runtime = createRuntime({
    dataDir: join(root, "state"),
    config: {
      services: [{ id: "svc", adapter: "fake", connection: {} }],
      plugins: withSecurity
        ? {
            security: {
              package: "security-test",
              enabled: true,
              critical: true,
              config: {},
            },
            emitter: { package: "emitter-test", enabled: true, config: {} },
          }
        : {},
    },
    pluginModuleLoader: async (specifier) => ({
      default: specifier === "emitter-test" ? emitter : security,
    }),
  });
  await runtime.refreshConfig();
  runtime.registry.register({
    id: "fake",
    metadata: { id: "fake", name: "Fake", version: "1.0.0" },
    catalog: {
      resources: [],
      actions: [{ id: "trigger" }],
      pages: [],
      components: [],
      jobs: [],
      signals: [{ id: "run-started", type: "info", schema: {} }],
      routes: [],
    },
    backend,
  });
}

const run = () =>
  runtime.app.request("/api/v1/services/svc/actions/trigger", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: { dag: "orders" } }),
  });

const signals = () =>
  runtime.signalBus.read({ limit: 50 }).items.map((event) => ({
    signalId: event.signalId,
    actor: event.actor,
    payload: event.payload,
  }));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "dsui-signal-actor-"));
  principal = { id: "user-ada", role: "owner" };
  outcome = "success";
  emits = true;
});

afterEach(async () => {
  await runtime.close();
  await rm(root, { recursive: true, force: true });
});

test("an action the adapter reports is one signal, naming the person who ran it", async () => {
  await start(true);
  expect((await run()).status).toBe(200);
  expect(signals()).toEqual([
    {
      signalId: "fake.run-started",
      actor: "user-ada",
      payload: { runId: "run-1" },
    },
  ]);
});

test("an action the adapter does not report is recorded once by the host", async () => {
  await start(true);
  emits = false;
  expect((await run()).status).toBe(200);
  expect(signals()).toEqual([
    {
      signalId: "dsui.action-executed",
      actor: "user-ada",
      payload: { action: "trigger", adapter: "fake", status: "success" },
    },
  ]);
});

test("a failed or crashed action is still recorded, as information rather than an alert, without its input", async () => {
  await start(true);
  emits = false;
  outcome = "error";
  await run();
  outcome = "throw";
  await run();
  const runs = runtime.signalBus
    .read({ limit: 50 })
    .items.filter((event) => event.signalId === "dsui.action-executed");
  expect(runs.map((event) => [event.type, event.actor, event.payload])).toEqual(
    [
      [
        "info",
        "user-ada",
        {
          action: "trigger",
          adapter: "fake",
          status: "error",
          message: "DAG is paused",
        },
      ],
      [
        "info",
        "user-ada",
        {
          action: "trigger",
          adapter: "fake",
          status: "error",
          message: "connection refused",
        },
      ],
    ],
  );
});

test("local single-user mode records no actor", async () => {
  await start(false);
  expect((await run()).status).toBe(200);
  expect(signals().map((signal) => signal.actor)).toEqual([undefined]);
});

test("listing events keeps the actor", async () => {
  await start(true);
  await run();
  const listed = runtime.signalBus.list({ signalId: "fake.run-started" });
  expect(listed.map((event) => event.actor)).toEqual(["user-ada"]);
});

test("a plugin signal raised in someone's request names them", async () => {
  await start(true);
  const response = await runtime.app.request(
    "/api/v1/plugins/emitter/procedures/note",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
  );
  expect(response.status).toBe(200);
  expect(signals()).toEqual([
    { signalId: "emitter.noted", actor: "user-ada", payload: { ok: true } },
  ]);
});
