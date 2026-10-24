import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AdapterHostClient,
  type AdapterHostRequest,
} from "../src/adapters/host";
import { RemoteBackend } from "../src/adapters/loader";
import { DsuiDatabase } from "../src/db/database";

const hostPath = new URL("../src/adapter-host.ts", import.meta.url).pathname;
const fixturePath = new URL("./fixtures/retained-adapter.ts", import.meta.url)
  .pathname;
let directory: string;
const clients: AdapterHostClient[] = [];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "dsui-host-"));
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await rm(directory, { recursive: true, force: true });
});

function client(
  options: {
    hostIdleTimeoutMs?: number;
    maxHosts?: number;
    bundle?: string;
  } = {},
) {
  const instance = new AdapterHostClient({
    command: process.execPath,
    args: [
      hostPath,
      "--bundle",
      options.bundle ?? fixturePath,
      "--database",
      join(directory, "state.sqlite"),
    ],
    timeoutMs: 5_000,
    hostIdleTimeoutMs: options.hostIdleTimeoutMs ?? 5_000,
    maxHosts: options.maxHosts,
  });
  clients.push(instance);
  return instance;
}

function request(
  overrides: Partial<AdapterHostRequest> = {},
): AdapterHostRequest {
  return {
    method: "resource",
    target: "inspect",
    input: {},
    persistenceNamespace: "service-a",
    connection: {
      method: "cached",
      logPath: join(directory, "events"),
      label: "a",
    },
    ...overrides,
  };
}

type Inspection = { contextId: string; pid: number; label: string };
async function inspect(
  host: AdapterHostClient,
  overrides: Partial<AdapterHostRequest> = {},
) {
  return (await host.request(request(overrides))) as { data: Inspection };
}
async function events() {
  return (await readFile(join(directory, "events"), "utf8")).trim().split("\n");
}

async function waitFor(check: () => Promise<boolean>) {
  const until = Date.now() + 3_000;
  while (!(await check())) {
    if (Date.now() > until)
      throw new Error("Timed out waiting for host lifecycle");
    await Bun.sleep(10);
  }
}

test("reuses context and process for page, resource and health calls", async () => {
  const host = client();
  const first = await inspect(host);
  await host.request(request({ method: "page", input: { path: "/" } }));
  await host.request(request({ method: "health" }));
  const second = await inspect(host);
  expect(second.data).toEqual(first.data);
  expect(await events()).toHaveLength(1);
  await host.close();
  expect(await events()).toEqual([
    `open:${first.data.contextId}`,
    `close:${first.data.contextId}`,
  ]);
});

test("isolates services and retires old credentials/configuration", async () => {
  const host = client();
  const first = await inspect(host);
  const other = await inspect(host, { persistenceNamespace: "service-b" });
  expect(other.data.pid).not.toBe(first.data.pid);
  const changed = await inspect(host, {
    connection: {
      method: "cached",
      logPath: join(directory, "events"),
      label: "changed",
    },
  });
  expect(changed.data.label).toBe("changed");
  expect(changed.data.pid).not.toBe(first.data.pid);
  expect(await events()).toContain(`close:${first.data.contextId}`);
});

test("disposes an idle context but keeps its host warm", async () => {
  const host = client();
  const first = await inspect(host);
  await waitFor(async () =>
    (await events()).includes(`close:${first.data.contextId}`),
  );
  const second = await inspect(host);
  expect(second.data.pid).toBe(first.data.pid);
  expect(second.data.contextId).not.toBe(first.data.contextId);
});

test("idle timers never dispose an active operation", async () => {
  const host = client({ hostIdleTimeoutMs: 80 });
  const first = await inspect(host, { input: { delayMs: 220 } });
  expect(await events()).toEqual([`open:${first.data.contextId}`]);
  const second = await inspect(host);
  expect(second.data).toEqual(first.data);
  await waitFor(async () =>
    (await events()).includes(`close:${first.data.contextId}`),
  );
  const third = await inspect(host);
  expect(third.data.pid).not.toBe(first.data.pid);
});

test("request-scoped contexts are disposed before replying while host is reused", async () => {
  const host = client();
  const connection = { method: "request", logPath: join(directory, "events") };
  const first = await inspect(host, { connection });
  expect(await events()).toContain(`close:${first.data.contextId}`);
  const second = await inspect(host, { connection });
  expect(second.data.pid).toBe(first.data.pid);
  expect(second.data.contextId).not.toBe(first.data.contextId);
});

test("queued cancellation does not kill the active call", async () => {
  const host = client();
  const active = inspect(host, { input: { delayMs: 100 } });
  const controller = new AbortController();
  const queued = inspect(host, { signal: controller.signal });
  const outcome = queued.then(
    () => undefined,
    (error: unknown) => error,
  );
  controller.abort();
  const first = await active;
  expect(await outcome).toBeInstanceOf(Error);
  expect((await inspect(host)).data.pid).toBe(first.data.pid);
});

test("timeout and active abort retire the process without replaying requests", async () => {
  const host = client();
  const first = await inspect(host);
  await expect(
    inspect(host, { input: { delayMs: 200 }, timeoutMs: 30 }),
  ).rejects.toThrow("timed out");
  const second = await inspect(host);
  expect(second.data.pid).not.toBe(first.data.pid);
  const controller = new AbortController();
  const active = inspect(host, {
    input: { delayMs: 200 },
    signal: controller.signal,
  });
  const outcome = active.then(
    () => undefined,
    (error: unknown) => error,
  );
  await Bun.sleep(20);
  controller.abort();
  expect(await outcome).toBeInstanceOf(Error);
  expect((await inspect(host)).data.pid).not.toBe(second.data.pid);
});

test("connection health honors its timeout and stops the adapter host", async () => {
  const host = client();
  const backend = new RemoteBackend(host, "retained-test", [
    { id: "cached", requestConcurrency: "parallel", contextIdleTimeoutMs: 100 },
  ]);
  const connection = request().connection;
  const health = await backend.checkHealth(connection, { timeoutMs: 10 });
  expect(health.status).toBe("unavailable");
  expect(health.detail).toBe("Adapter host timed out");
  expect(await inspect(host)).toHaveProperty("data.pid");
});

test("crash fails the request and next call starts a fresh host", async () => {
  const host = client();
  const first = await inspect(host);
  await expect(inspect(host, { input: { crash: true } })).rejects.toThrow(
    "exited",
  );
  expect((await inspect(host)).data.pid).not.toBe(first.data.pid);
});

test("evicts idle hosts at the retention limit", async () => {
  const host = client({ maxHosts: 1 });
  const first = await inspect(host);
  const second = await inspect(host, { persistenceNamespace: "service-b" });
  expect(second.data.pid).not.toBe(first.data.pid);
  expect(await events()).toContain(`close:${first.data.contextId}`);
  expect((await inspect(host)).data.pid).not.toBe(first.data.pid);
});

test("busy overflow uses an ephemeral host without interrupting the retained host", async () => {
  const host = client({ maxHosts: 1 });
  const active = inspect(host, { input: { delayMs: 150 } });
  await waitFor(async () => {
    try {
      return (await events()).length > 0;
    } catch {
      return false;
    }
  });
  const overflow = await inspect(host, { persistenceNamespace: "service-b" });
  expect(await events()).toContain(`close:${overflow.data.contextId}`);
  const first = await active;
  expect((await inspect(host)).data.pid).toBe(first.data.pid);
});

test("unscoped connection tests never retain their context", async () => {
  const host = client();
  const first = await inspect(host, { persistenceNamespace: undefined });
  expect(await events()).toContain(`close:${first.data.contextId}`);
  expect(
    (await inspect(host, { persistenceNamespace: undefined })).data.pid,
  ).not.toBe(first.data.pid);
});

test("invalidating a service releases its context and blocks future queued work", async () => {
  const host = client();
  const first = await inspect(host);
  const active = inspect(host, { input: { delayMs: 80 } });
  await Bun.sleep(10);
  const queued = inspect(host);
  const outcome = queued.then(
    () => undefined,
    (error: unknown) => error,
  );
  await host.invalidateService("service-a");
  await active;
  expect(await outcome).toBeInstanceOf(Error);
  expect(await events()).toContain(`close:${first.data.contextId}`);
  expect((await inspect(host)).data.pid).not.toBe(first.data.pid);
});

test("oversized requests and responses retire their session without leaking hosts", async () => {
  const host = client();
  const first = await inspect(host);
  await expect(
    inspect(host, { input: { payload: "x".repeat(300_000) } }),
  ).rejects.toThrow("exceeds output limit");
  const second = await inspect(host);
  expect(second.data.pid).not.toBe(first.data.pid);
  await expect(
    inspect(host, { input: { outputBytes: 300_000 } }),
  ).rejects.toThrow("exceeds output limit");
  expect((await inspect(host)).data.pid).not.toBe(second.data.pid);
});

test("active action cancellation reaches adapter helpers without interrupting reads", async () => {
  const host = client();
  const first = await inspect(host);
  const controller = new AbortController();
  const action = host.request(
    request({
      method: "action",
      target: "update",
      input: { delayMs: 200 },
      signal: controller.signal,
    }),
  );
  const outcome = action.then(
    () => undefined,
    (error: unknown) => error,
  );
  await waitFor(
    async () =>
      (await events()).filter((line) => line.startsWith("open:")).length === 2,
  );
  controller.abort();
  expect((await inspect(host)).data.pid).toBe(first.data.pid);
  expect(await outcome).toBeInstanceOf(Error);
  expect(await host.request(request({ target: "stored" }))).toEqual({
    data: { value: 0 },
  });
});

test("DuckDB file lock is available to another process after each resource response", async () => {
  const bundle = new URL("../../adapter-duckdb/src/adapter.ts", import.meta.url)
    .pathname;
  const host = client({ bundle });
  const path = join(directory, "test.duckdb");
  for (let index = 0; index < 2; index++) {
    await host.request(
      request({
        target: "version",
        connection: { method: "file", path, readOnly: false },
      }),
    );
    const external = Bun.spawn(
      [
        process.execPath,
        "-e",
        "import { DuckDBInstance } from '@duckdb/node-api'; const db = await DuckDBInstance.create(process.argv[1]); const c = await db.connect(); await c.run('CREATE TABLE IF NOT EXISTS external_writer (id INTEGER)'); c.closeSync(); db.closeSync();",
        path,
      ],
      {
        cwd: new URL("../../adapter-duckdb", import.meta.url).pathname,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const stderr = await new Response(external.stderr).text();
    expect(await external.exited, stderr).toBe(0);
  }
});

test("isolated actions and jobs do not block reads and their persisted updates are visible", async () => {
  const database = new DsuiDatabase(join(directory, "state.sqlite"));
  database.close();
  const host = client();
  const stored = () => host.request(request({ target: "stored" }));
  expect(await stored()).toEqual({ data: { value: 0 } });
  const action = host.request(
    request({ method: "action", target: "update", input: { delayMs: 200 } }),
  );
  let finished = false;
  void action.then(() => {
    finished = true;
  });
  await Bun.sleep(40);
  expect(await stored()).toEqual({ data: { value: 0 } });
  expect(finished).toBe(false);
  await action;
  expect(await stored()).toEqual({ data: { value: 1 } });
  await host.request(
    request({ method: "job", target: "update-job", runId: "run-1" }),
  );
  expect(await stored()).toEqual({ data: { value: 2 } });
});
