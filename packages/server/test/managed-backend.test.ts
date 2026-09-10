import { expect, test } from "bun:test";
import { join } from "node:path";
import { AdapterHostClient } from "../src/adapters/host";
import { loadAdapter } from "../src/adapters/loader";
import { createRuntime } from "../src/app";

const bundle = join(import.meta.dir, "fixtures/session-adapter.ts");
test("HTTP calls retain state through configuration refresh and isolate configured services", async () => {
  const runtime = createRuntime({
    databasePath: ":memory:",
    authMode: "none",
    config: {
      adapters: { "session-fixture": { package: bundle } },
      services: [
        { id: "a", name: "A", adapter: "session-fixture", connection: {} },
        { id: "b", name: "B", adapter: "session-fixture", connection: {} },
      ],
    },
  });
  const request = (service: string, target: string) =>
    runtime.app.request(`/api/v1/services/${service}/${target}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  try {
    expect((await request("a", "actions/increment")).status).toBe(200);
    expect(await (await request("a", "resources/count")).json()).toEqual({
      data: 1,
    });
    expect(await (await request("b", "resources/count")).json()).toEqual({
      data: 0,
    });
  } finally {
    await runtime.close();
  }
});
test("local backend retains service state across actions and isolates matching connections", async () => {
  const { backend } = await loadAdapter("session-fixture", { package: bundle });
  try {
    await backend.executeAction("increment", {}, undefined, undefined, "a");
    expect(await backend.executeResource("count", {}, undefined, "a")).toEqual({
      data: 1,
    });
    expect(await backend.executeResource("count", {}, undefined, "b")).toEqual({
      data: 0,
    });
    await backend.closeSession?.("a");
    expect(await backend.executeResource("count", {}, undefined, "a")).toEqual({
      data: 0,
    });
  } finally {
    await backend.dispose?.();
  }
});

test("subprocess sessions retain state, isolate services, and survive an operation error", async () => {
  const host = new AdapterHostClient({
    command: process.execPath,
    args: [join(import.meta.dir, "../src/adapter-host.ts"), "--bundle", bundle],
    timeoutMs: 5000,
  });
  try {
    await host.request({
      method: "action",
      target: "increment",
      sessionId: "a",
    });
    await expect(
      host.request({ method: "resource", target: "missing", sessionId: "a" }),
    ).rejects.toThrow("Unknown resource");
    expect(
      await host.request({
        method: "resource",
        target: "count",
        sessionId: "a",
      }),
    ).toEqual({ data: 1 });
    expect(
      await host.request({
        method: "resource",
        target: "count",
        sessionId: "b",
      }),
    ).toEqual({ data: 0 });
    await host.closeSession("a");
    expect(
      await host.request({
        method: "resource",
        target: "count",
        sessionId: "a",
      }),
    ).toEqual({ data: 0 });
  } finally {
    await host.dispose();
  }
});
