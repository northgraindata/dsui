import { expect, test } from "bun:test";
import {
  createAdapterInstance,
  createMemoryBlobStore,
} from "@northgraindata/dsui-adapter-sdk";
import { createDbtAdapter } from "../src/adapter";
import { createContext } from "../src/context";
import { dbtHealth } from "../src/health";
import { artifacts } from "../src/resources/artifacts";
import { dashboard } from "../src/resources/dashboard";

const connection = { method: "push", pushToken: "t".repeat(32) };
const put = (name: string, body: unknown, raw?: string) => ({
  method: "PUT" as const,
  path: `/artifacts/${name}`,
  params: { name },
  query: {},
  headers: {},
  body: new TextEncoder().encode(raw ?? JSON.stringify(body)),
});
const live = { signal: new AbortController().signal };

const manifest = {
  metadata: {
    dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v12.json",
  },
  nodes: {
    "model.p.a": { resource_type: "model" },
    "model.p.b": { resource_type: "model" },
    "test.p.t": { resource_type: "test" },
  },
};
const runResults = (status: string) => ({
  metadata: { invocation_id: "inv-1", generated_at: "2026-10-30T10:00:00Z" },
  results: [{ unique_id: "model.p.a", status }],
});

async function connect() {
  const blobStore = createMemoryBlobStore();
  const instance = await createAdapterInstance(createDbtAdapter(), connection, {
    blobStore,
  });
  return { instance, blobStore };
}

test("the push method needs a token long enough to be a secret", () => {
  const adapter = createDbtAdapter();
  expect(
    adapter.connectionSchema?.safeParse({ method: "push", pushToken: "short" })
      .success,
  ).toBe(false);
  expect(adapter.connectionSchema?.safeParse(connection).success).toBe(true);
  expect(adapter.routes.map((route) => route.id)).toEqual(["push-artifact"]);
  expect(adapter.routes[0]?.auth).toEqual({ token: "pushToken" });
});

test("a pushed manifest is what the resources read", async () => {
  const { instance } = await connect();
  const reply = await instance.runRoute(
    "push-artifact",
    put("manifest.json", manifest),
    live,
  );
  expect(reply.response.status).toBe(201);

  const listed = await instance.executeResource(artifacts());
  expect(listed.status).toBe("success");
  const present = (listed.status === "success" ? listed.data : []).filter(
    (item) => item.present,
  );
  expect(present.map((item) => item.name)).toEqual(["manifest.json"]);

  const summary = await instance.executeResource(dashboard());
  expect(summary).toMatchObject({
    status: "success",
    data: { models: 2, tests: 1 },
  });
});

test("a later push replaces the earlier one", async () => {
  const { instance } = await connect();
  await instance.runRoute(
    "push-artifact",
    put("manifest.json", manifest),
    live,
  );
  await instance.runRoute(
    "push-artifact",
    put("manifest.json", {
      nodes: { "model.p.only": { resource_type: "model" } },
    }),
    live,
  );
  const summary = await instance.executeResource(dashboard());
  expect(summary).toMatchObject({ data: { models: 1 } });
});

test("run_results raises the run signal once per invocation", async () => {
  const { instance } = await connect();
  const failed = await instance.runRoute(
    "push-artifact",
    put("run_results.json", runResults("error")),
    live,
  );
  expect(failed.emissions).toEqual([
    {
      signalId: "run-failed",
      payload: {
        runId: "inv-1",
        generatedAt: "2026-10-30T10:00:00Z",
        failedNodes: ["model.p.a"],
        warningNodes: [],
      },
      idempotencyKey: "inv-1",
    },
  ]);
  const passed = await instance.runRoute(
    "push-artifact",
    put("run_results.json", runResults("success")),
    live,
  );
  expect(passed.emissions[0]?.signalId).toBe("run-succeeded");
});

test("bad uploads are refused and store nothing", async () => {
  const { instance, blobStore } = await connect();
  const cases = [
    [put("nonsense.json", {}), 404],
    [put("manifest.json", null, "{not json"), 422],
    [put("manifest.json", [1, 2]), 422],
  ] as const;
  for (const [request, status] of cases) {
    const reply = await instance.runRoute("push-artifact", request, live);
    expect(reply.response.status).toBe(status);
  }
  expect(await blobStore.list()).toEqual([]);
});

test("a service on another method does not accept pushes", async () => {
  const instance = await createAdapterInstance(
    createDbtAdapter(),
    { method: "local", projectPath: "/tmp", executable: "dbt" },
    { blobStore: createMemoryBlobStore() },
  );
  const reply = await instance.runRoute(
    "push-artifact",
    put("manifest.json", manifest),
    live,
  );
  expect(reply.response.status).toBe(409);
});

test("health says whether CI has delivered anything", async () => {
  const blobs = createMemoryBlobStore();
  const ctx = await createContext({
    method: "push",
    pushToken: connection.pushToken,
  });
  const before = await dbtHealth(ctx, { blobs });
  expect(before.checks[0]?.ok).toBe(false);
  expect(before.checks[0]?.detail).toContain("Nothing pushed yet");

  await blobs.put("artifacts/manifest.json", "{}");
  const after = await dbtHealth(ctx, { blobs });
  expect(after.checks[0]?.ok).toBe(true);
  expect(after.status).toBe("healthy");
});
