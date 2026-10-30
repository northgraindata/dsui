import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DsuiDatabase } from "../src/db/database";
import {
  countPluginKinds,
  countServicesByAdapter,
  countUsage,
  createTelemetry,
  deploymentKind,
  installAgeDays,
  readInstallId,
  telemetryEnabled,
  telemetryEventSchema,
} from "../src/telemetry";

const snapshot = () => ({
  serviceAdapters: ["postgresql", "postgresql", "acme-internal"],
  pluginPackages: ["@northgraindata/dsui-plugin-health", "acme-private-plugin"],
  usage: { actionsExecuted: 3, pluginProcedures: 0, servicesCreated: 1 },
  errors: {},
  installCreatedAt: undefined,
});

test("any single opt-out disables telemetry", () => {
  expect(telemetryEnabled({})).toBe(true);
  expect(telemetryEnabled({ DSUI_TELEMETRY: "off" })).toBe(false);
  expect(telemetryEnabled({ DO_NOT_TRACK: "1" })).toBe(false);
  expect(telemetryEnabled({}, { telemetry: { enabled: false } })).toBe(false);
  expect(telemetryEnabled({}, { telemetry: { enabled: true } })).toBe(true);
});

test("community adapter ids are bucketed so they cannot identify an operator", () => {
  expect(
    countServicesByAdapter(["postgresql", "postgresql", "acme-internal"]),
  ).toEqual({ postgresql: 2, other: 1 });
});

test("install id is created once and stable across reads", () => {
  const database = new DsuiDatabase(":memory:");
  const first = readInstallId(database);
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
  expect(readInstallId(database)).toBe(first);
  database.close();
});

test("sent payload matches the documented schema and holds no free text", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const telemetry = createTelemetry({
    installId: crypto.randomUUID(),
    version: "1.2.3",
    env: {},
    url: "https://relay.test/v1/telemetry",
    snapshot,
    fetch: (async (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch,
  });
  telemetry.start();
  await Bun.sleep(10);
  telemetry.stop();
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe("https://relay.test/v1/telemetry");
  const event = telemetryEventSchema.parse(requests[0]?.body);
  expect(event.event).toBe("server_started");
  expect(event.serviceCounts).toEqual({ postgresql: 2, other: 1 });
  expect(JSON.stringify(event)).not.toContain("acme-internal");
});

test("a failing relay never throws into the server", async () => {
  const telemetry = createTelemetry({
    installId: crypto.randomUUID(),
    version: "1.2.3",
    env: {},
    snapshot,
    fetch: (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch,
  });
  expect(() => telemetry.start()).not.toThrow();
  await Bun.sleep(10);
  telemetry.stop();
});

test("deployment kind falls back to other and managed carries the cloud token", async () => {
  expect(deploymentKind("docker")).toBe("docker");
  expect(deploymentKind("managed")).toBe("managed");
  expect(deploymentKind("whatever")).toBe("other");
  expect(deploymentKind(undefined)).toBe("other");

  let seen: { auth: string | null; deployment: string } | undefined;
  const telemetry = createTelemetry({
    installId: crypto.randomUUID(),
    version: "1.2.3",
    env: { DSUI_DEPLOYMENT: "managed", DSUI_TELEMETRY_TOKEN: "tok" },
    snapshot,
    fetch: (async (_url: string, init: RequestInit) => {
      seen = {
        auth: new Headers(init.headers).get("authorization"),
        deployment: JSON.parse(String(init.body)).deployment,
      };
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch,
  });
  telemetry.start();
  await Bun.sleep(10);
  telemetry.stop();
  expect(seen).toEqual({ auth: "Bearer tok", deployment: "managed" });
});

test("plugins are reported by first-party name, everything else as other", () => {
  expect(
    countPluginKinds([
      "@northgraindata/dsui-plugin-health",
      "@northgraindata/dsui-plugin-health",
      "@acme/secret-plugin",
      "",
    ]),
  ).toEqual({ health: 2, other: 2 });
});

test("usage counts audited actions from the last day under fixed names", () => {
  const database = new DsuiDatabase(":memory:");
  database.audit("local", "action.execute", "svc-1", { secret: "x" });
  database.audit("local", "action.execute", "svc-2");
  database.audit("local", "service.create", "svc-1");
  database.audit("local", "settings.update", "installation");
  database.sqlite
    .query("UPDATE audit_events SET at = ? WHERE action = 'service.create'")
    .run(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  expect(countUsage(database)).toEqual({
    actionsExecuted: 2,
    pluginProcedures: 0,
    servicesCreated: 0,
  });
  database.close();
});

test("install age counts whole days and tolerates a missing date", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  expect(installAgeDays("2026-10-27T13:00:00Z", now)).toBe(2);
  expect(installAgeDays(undefined, now)).toBe(0);
});

test("CI runs are flagged so throwaway installs can be filtered out", async () => {
  const bodies: Array<{ ci: boolean }> = [];
  for (const env of [{ CI: "true" }, {}]) {
    const telemetry = createTelemetry({
      installId: crypto.randomUUID(),
      version: "1.2.3",
      env,
      snapshot,
      fetch: (async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }) as unknown as typeof fetch,
    });
    telemetry.start();
    await Bun.sleep(10);
    telemetry.stop();
  }
  expect(bodies.map((body) => body.ci)).toEqual([true, false]);
});

test("every field the event can carry is documented, and nothing else is", async () => {
  const page = await Bun.file(
    new URL("../../../apps/docs/content/docs/telemetry.mdx", import.meta.url),
  ).text();
  const documented = page
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .flatMap((line) => {
      const firstCell = line.split("|")[1] ?? "";
      return [...firstCell.matchAll(/`([A-Za-z0-9]+)`/g)].map((m) => m[1]);
    })
    .sort();
  expect(documented).toEqual(Object.keys(telemetryEventSchema.shape).sort());
});

test("the error counter names built-in adapters, hides the rest, and forgets what it reported", async () => {
  const { createErrorCounter } = await import("../src/telemetry/errors");
  const counter = createErrorCounter();
  counter.record("action_failed", "postgresql");
  counter.record("action_failed", "postgresql");
  counter.record("adapter_load_failed", "acme-internal");
  counter.record("unhandled_error");
  expect(counter.drain()).toEqual({
    "action_failed.postgresql": 2,
    "adapter_load_failed.other": 1,
    unhandled_error: 1,
  });
  expect(counter.drain()).toEqual({});
});

test("a failed action or resource read counts, a refusal does not", async () => {
  const { createRuntime } = await import("../src/app");
  const runtime = createRuntime({
    dataDir: await mkdtemp(join(tmpdir(), "dsui-err-")),
    config: { services: [] },
  });
  try {
    runtime.app.post(
      "/api/v1/services/svc/actions/boom/probe",
      () => new Response("x", { status: 502 }),
    );
    runtime.app.post(
      "/api/v1/services/svc/resources/slow/probe",
      () => new Response("x", { status: 500 }),
    );
    runtime.app.post(
      "/api/v1/services/svc/actions/denied/probe",
      () => new Response("x", { status: 403 }),
    );
    for (const path of [
      "actions/boom/probe",
      "resources/slow/probe",
      "actions/denied/probe",
    ])
      await runtime.app.request(`/api/v1/services/svc/${path}`, {
        method: "POST",
      });
    expect(runtime.errors.drain()).toEqual({
      action_failed: 1,
      resource_query_failed: 1,
    });
  } finally {
    await runtime.close();
  }
});
