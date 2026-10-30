import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineAdapter } from "./adapter/define";
import { assertBlobKey, createMemoryBlobStore } from "./blob";
import { defineRoute, RouteError, routeJson } from "./route";
import { createAdapterInstance } from "./runtime/adapter-runtime";
import { defineSignal } from "./signal";
import { defineStore } from "./store";

const health = async () => ({
  status: "healthy" as const,
  score: 100,
  checks: [],
});

const received = defineSignal({
  id: "received",
  type: "info",
  schema: z.object({ bytes: z.number() }),
});

const counter = defineStore({
  id: "counter",
  scope: "adapter",
  state: { hits: 0 },
  persistence: { type: "memory" },
  actions: ({ set, get }) => ({
    hit: () => set({ hits: get().hits + 1 }),
  }),
});

const upload = defineRoute({
  id: "upload",
  method: "POST",
  path: "/files/:name",
  auth: { token: "secret" },
  handle: async ({ request, blobs, store, emit }) => {
    if (request.query.fail) throw new RouteError(422, "nope");
    if (request.query.crash) throw new Error("secret detail");
    await blobs.put(`files/${request.params.name}`, request.body);
    store(counter).actions.hit();
    emit(received, { bytes: request.body.byteLength });
    return routeJson({ stored: request.json() }, 201);
  },
});

const adapter = defineAdapter({
  metadata: { id: "routes", name: "Routes", version: "1.0.0" },
  health,
  stores: [counter],
  signals: [received],
  routes: [upload],
});

const request = (overrides: Record<string, unknown> = {}) => ({
  method: "POST" as const,
  path: "/files/a",
  params: { name: "a" },
  query: {},
  headers: {},
  body: new TextEncoder().encode('{"ok":true}'),
  ...overrides,
});

describe("defineRoute", () => {
  test("defaults the permission from the method and the body limit", () => {
    expect(upload.permission).toBe("execute");
    expect(upload.maxBodyBytes).toBe(1024 * 1024);
    expect(
      defineRoute({
        id: "read",
        method: "GET",
        path: "/status",
        auth: "principal",
        handle: () => routeJson({}),
      }).permission,
    ).toBe("inspect");
  });

  const base = {
    id: "ok",
    method: "POST" as const,
    path: "/x",
    auth: "principal" as const,
    handle: () => routeJson({}),
  };
  test.each([
    ["a bad id", { id: "Bad Id" }],
    ["a path without a slash", { path: "x" }],
    ["a path that climbs", { path: "/a/../b" }],
    ["a repeated parameter", { path: "/:a/:a" }],
    ["an empty token field", { auth: { token: "" } }],
    ["a body limit past the ceiling", { maxBodyBytes: 10 ** 10 }],
    ["a zero timeout", { timeoutMs: 0 }],
  ])("rejects %s", (_, override) => {
    expect(() => defineRoute({ ...base, ...override })).toThrow();
  });

  test("an adapter rejects two routes on one method and path", () => {
    expect(() =>
      defineAdapter({
        metadata: { id: "dup", name: "Dup", version: "1.0.0" },
        health,
        routes: [upload, { ...upload, id: "other" }],
      }),
    ).toThrow("Duplicate adapter route method and path");
  });

  test("an adapter without routes has none", () => {
    expect(
      defineAdapter({
        metadata: { id: "none", name: "None", version: "1.0.0" },
        health,
      }).routes,
    ).toEqual([]);
  });
});

describe("runRoute", () => {
  test("runs the handler with blobs, stores and signals", async () => {
    const blobStore = createMemoryBlobStore();
    const instance = await createAdapterInstance(adapter, {}, { blobStore });
    const { response, emissions } = await instance.runRoute(
      "upload",
      request(),
      { signal: new AbortController().signal },
    );
    expect(response.status).toBe(201);
    expect(JSON.parse(String(response.body))).toEqual({ stored: { ok: true } });
    expect(emissions).toEqual([
      { signalId: "received", payload: { bytes: 11 } },
    ]);
    expect(await blobStore.get("files/a")).toEqual(request().body);
    expect(instance.store(counter).get().hits).toBe(1);
  });

  test("a RouteError becomes its status and message", async () => {
    const instance = await createAdapterInstance(adapter);
    const { response } = await instance.runRoute(
      "upload",
      request({ query: { fail: "1" } }),
      { signal: new AbortController().signal },
    );
    expect(response.status).toBe(422);
    expect(JSON.parse(String(response.body))).toEqual({ message: "nope" });
  });

  test("any other failure propagates for the host to hide", async () => {
    const instance = await createAdapterInstance(adapter);
    await expect(
      instance.runRoute("upload", request({ query: { crash: "1" } }), {
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("secret detail");
  });

  test("invalid JSON is a 400, an unknown route an error", async () => {
    const instance = await createAdapterInstance(adapter);
    const { response } = await instance.runRoute(
      "upload",
      request({ body: new TextEncoder().encode("{") }),
      { signal: new AbortController().signal },
    );
    expect(response.status).toBe(400);
    await expect(
      instance.runRoute("missing", request(), {
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("Unknown adapter route");
  });
});

describe("blob store", () => {
  test("round-trips, lists by prefix and deletes", async () => {
    const blobs = createMemoryBlobStore();
    await blobs.put("runs/1/a.json", "{}");
    await blobs.put("runs/2/a.json", new Uint8Array([1, 2, 3]));
    expect((await blobs.list("runs/1")).map((blob) => blob.key)).toEqual([
      "runs/1/a.json",
    ]);
    expect((await blobs.stat("runs/2/a.json"))?.size).toBe(3);
    expect(await blobs.delete("runs/1/a.json")).toBe(true);
    expect(await blobs.delete("runs/1/a.json")).toBe(false);
    expect(await blobs.get("runs/1/a.json")).toBeNull();
  });

  test.each(["", "/abs", "a//b", "../x", "a/../b", ".hidden", "a b", "a\\b"])(
    "rejects the key %j",
    (key) => {
      expect(() => assertBlobKey(key)).toThrow();
    },
  );
});
