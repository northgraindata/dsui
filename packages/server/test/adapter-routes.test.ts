import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdapterHostClient } from "../src/adapters/host";
import { RemoteBackend } from "../src/adapters/loader";
import { createRuntime } from "../src/app";

const TOKEN = "s3cret-token";
let directory: string;
let runtime: ReturnType<typeof createRuntime>;
let host: AdapterHostClient;

const url = (path: string, service = "pushed") =>
  `http://dsui.test/adapters/v1/services/${service}${path}`;
const call = (path: string, init: RequestInit = {}, service?: string) =>
  runtime.app.request(url(path, service), init);
const authed = (init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { authorization: `Bearer ${TOKEN}`, ...init.headers },
});

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "dsui-routes-"));
  const configPath = join(directory, "dsui.yaml");
  await writeFile(
    configPath,
    JSON.stringify({
      services: [
        { id: "pushed", adapter: "route-test", connection: { token: TOKEN } },
        { id: "unset", adapter: "route-test", connection: {} },
      ],
    }),
  );
  runtime = createRuntime({ configPath, dataDir: directory });
  host = new AdapterHostClient({
    command: process.execPath,
    args: [
      new URL("../src/adapter-host.ts", import.meta.url).pathname,
      "--bundle",
      new URL("./fixtures/route-adapter.ts", import.meta.url).pathname,
      "--blobs",
      join(directory, "blobs"),
    ],
    timeoutMs: 10_000,
  });
  const described = (await host.request({ method: "describe" })) as {
    routes: never[];
  };
  await runtime.refreshConfig();
  runtime.registry.register({
    id: "route-test",
    metadata: { id: "route-test", name: "Route test", version: "1.0.0" },
    catalog: {
      resources: [],
      actions: [],
      pages: [],
      components: [],
      jobs: [],
      signals: [],
      routes: described.routes,
    },
    backend: new RemoteBackend(host, "route-test", []),
  });
});

afterAll(async () => {
  await runtime.close();
  await host.close();
  await rm(directory, { recursive: true, force: true });
});

test("the adapter host describes its routes", () => {
  expect(runtime.registry.get("route-test").catalog.routes).toHaveLength(2);
});

test("a token caller uploads and a user reads it back", async () => {
  const put = await call(
    "/files/a.json",
    authed({ method: "PUT", body: '{"x":1}' }),
  );
  expect(put.status).toBe(201);
  expect(await put.json()).toEqual({ size: 7 });

  const read = await call("/files/a.json");
  expect(read.status).toBe(200);
  expect(await read.json()).toEqual({ text: '{"x":1}' });
});

test("a caller without the right token is refused, and never reaches the adapter", async () => {
  for (const init of [
    { method: "PUT", body: "x" },
    { method: "PUT", body: "x", headers: { authorization: "Bearer wrong" } },
    { method: "PUT", body: "x", headers: { authorization: TOKEN } },
  ]) {
    const response = await call("/files/denied", init);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  }
  expect((await call("/files/denied")).status).toBe(404);
});

test("a service with no secret set refuses every caller", async () => {
  for (const authorization of ["Bearer ", "Bearer undefined", "Bearer "]) {
    const response = await call(
      "/files/a",
      { method: "PUT", body: "x", headers: { authorization } },
      "unset",
    );
    expect(response.status).toBe(401);
  }
});

test("the body limit holds against content-length and against a stream", async () => {
  const declared = await call(
    "/files/big",
    authed({ method: "PUT", body: "x".repeat(2000) }),
  );
  expect(declared.status).toBe(413);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600));
      controller.enqueue(new Uint8Array(600));
      controller.close();
    },
  });
  const streamed = await call(
    "/files/big",
    authed({ method: "PUT", body: stream, duplex: "half" } as RequestInit),
  );
  expect(streamed.status).toBe(413);
  expect((await call("/files/big")).status).toBe(404);
});

test("a handler can choose its status; any other failure is hidden", async () => {
  const chosen = await call("/files/a?fail=1", authed({ method: "PUT" }));
  expect(chosen.status).toBe(422);
  expect(await chosen.json()).toEqual({ message: "rejected" });

  const original = console.error;
  console.error = () => undefined;
  try {
    const crashed = await call("/files/a?crash=1", authed({ method: "PUT" }));
    expect(crashed.status).toBe(500);
    expect(await crashed.text()).not.toContain("/secret/host/path");
  } finally {
    console.error = original;
  }
});

test("a reply cannot set cookies and is locked down for the shared origin", async () => {
  const response = await call("/files/h", authed({ method: "PUT", body: "x" }));
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("content-security-policy")).toContain("sandbox");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});

test("unknown services, paths and methods are 404", async () => {
  expect((await call("/files/a", {}, "missing")).status).toBe(404);
  expect((await call("/nothing", authed())).status).toBe(404);
  expect((await call("/files/a", authed({ method: "DELETE" }))).status).toBe(
    404,
  );
});

test("calls are audited and no request body is left on disk", async () => {
  const rows = runtime.database.sqlite
    .query("SELECT actor, action, target FROM audit_events WHERE action = ?")
    .all("route.call") as { actor: string; action: string; target: string }[];
  expect(rows).toContainEqual({
    actor: "route-token:pushed",
    action: "route.call",
    target: "pushed",
  });
  expect(rows).toContainEqual({
    actor: "local",
    action: "route.call",
    target: "pushed",
  });
  const spool = join(directory, "tmp", "route-bodies");
  expect(await readdir(spool)).toEqual([]);
});
