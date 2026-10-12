import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdapterHostClient } from "../src/adapters/host";
import { RemoteBackend } from "../src/adapters/loader";
import { createRuntime } from "../src/app";

test("configuration changes, service removal and runtime shutdown retire service hosts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-lifecycle-http-"));
  const configPath = join(directory, "dsui.yaml");
  const logPath = join(directory, "events");
  const connection = { method: "cached", logPath, label: "original" };
  const saveConfig = (
    services: { id: string; adapter: string; connection: typeof connection }[],
  ) => writeFile(configPath, JSON.stringify({ services }));
  await saveConfig([
    { id: "configured", adapter: "retained-test", connection },
  ]);
  const runtime = createRuntime({ configPath, dataDir: directory });
  const host = new AdapterHostClient({
    command: process.execPath,
    args: [
      new URL("../src/adapter-host.ts", import.meta.url).pathname,
      "--bundle",
      new URL("./fixtures/retained-adapter.ts", import.meta.url).pathname,
    ],
    timeoutMs: 5_000,
  });
  const backend = new RemoteBackend(host, "retained-test", [
    { id: "cached", requestConcurrency: "parallel", contextIdleTimeoutMs: 100 },
  ]);
  const isClosed = async (id: string) =>
    (await readFile(logPath, "utf8")).includes(`close:${id}`);
  const read = async (label: string) => {
    const result = await backend.executeResource(
      "inspect",
      { ...connection, label },
      {},
      { persistenceNamespace: "configured" },
    );
    return result.data as { contextId: string };
  };
  try {
    await runtime.refreshConfig();
    runtime.registry.register({
      id: "retained-test",
      metadata: { id: "retained-test", name: "Test", version: "1.0.0" },
      catalog: {
        resources: [],
        actions: [],
        pages: [],
        components: [],
        jobs: [],
        signals: [],
      },
      backend,
    });
    const original = await read("original");
    await saveConfig([
      {
        id: "configured",
        adapter: "retained-test",
        connection: { ...connection, label: "changed" },
      },
    ]);
    await runtime.refreshConfig();
    expect(await isClosed(original.contextId)).toBe(true);
    const changed = await read("changed");
    await saveConfig([]);
    await runtime.refreshConfig();
    expect(await isClosed(changed.contextId)).toBe(true);
    const last = await read("shutdown");
    await runtime.close();
    expect(await isClosed(last.contextId)).toBe(true);
  } finally {
    await host.close();
    await runtime.close();
    await rm(directory, { recursive: true, force: true });
  }
});
