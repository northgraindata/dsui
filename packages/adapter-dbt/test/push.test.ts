import { describe, expect, test } from "bun:test";
import {
  createAdapterInstance,
  createMemoryBlobStore,
} from "@northgraindata/dsui-adapter-sdk";
import { createDbtAdapter } from "../src/adapter";
import { createContext } from "../src/context";
import { dbtHealth } from "../src/health";
import { artifacts } from "../src/resources/artifacts";
import { dashboard, recentRuns } from "../src/resources/dashboard";
import { runDetail } from "../src/resources/run-detail";
import { runs } from "../src/resources/runs";
import {
  archiveRun,
  MAX_KEPT_RUNS,
  RUN_RETENTION_MS,
  runKey,
} from "../src/run-history";

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

test("a push service is healthy before its first upload, and says what it waits for", async () => {
  const blobs = createMemoryBlobStore();
  const ctx = await createContext({
    method: "push",
    pushToken: connection.pushToken,
  });
  const before = await dbtHealth(ctx, { blobs });
  // The connection test needs a healthy service before it can be saved.
  expect(before.status).toBe("healthy");
  expect(before.checks[0]?.detail).toContain("Waiting for the first upload");

  await blobs.put("artifacts/manifest.json", "{}");
  const after = await dbtHealth(ctx, { blobs });
  expect(after.status).toBe("healthy");
  expect(after.checks[0]?.detail).toContain("1 artifact");
});

describe("run history", () => {
  const runAt = (id: string, generated: string, status = "success") => ({
    metadata: { generated_at: generated, invocation_id: id },
    results: [{ status, unique_id: "model.p.a" }],
  });
  const pushRun = (
    instance: Awaited<ReturnType<typeof connect>>["instance"],
    body: unknown,
  ) => instance.runRoute("push-artifact", put("run_results.json", body), live);

  test("every pushed run is kept and listed newest first", async () => {
    const { instance } = await connect();
    await pushRun(instance, runAt("run-a", "2026-10-30T09:00:00Z"));
    await pushRun(instance, runAt("run-b", "2026-10-30T11:00:00Z", "error"));

    const listed = await instance.executeResource(runs());
    expect(listed.status === "success" ? listed.data : []).toMatchObject([
      { id: "run-b", status: "error" },
      { id: "run-a", status: "success" },
    ]);
  });

  test("pushing the same run again replaces it", async () => {
    const { instance } = await connect();
    await pushRun(instance, runAt("run-a", "2026-10-30T09:00:00Z", "error"));
    await pushRun(instance, runAt("run-a", "2026-10-30T09:00:00Z"));
    const listed = await instance.executeResource(runs());
    expect(listed.status === "success" ? listed.data : []).toMatchObject([
      { id: "run-a", status: "success" },
    ]);
  });

  test("a run opens from its own results, not the latest", async () => {
    const { instance } = await connect();
    await pushRun(instance, runAt("run-a", "2026-10-30T09:00:00Z", "error"));
    await pushRun(instance, runAt("run-b", "2026-10-30T11:00:00Z"));
    const detail = await instance.executeResource(
      runDetail({ runId: "run-a" }),
    );
    expect(detail).toMatchObject({
      data: { id: "run-a", resultCount: 1, status: "error" },
    });
  });

  test("the dashboard lists the most recent runs", async () => {
    const { instance } = await connect();
    await pushRun(instance, runAt("run-a", "2026-10-30T09:00:00Z"));
    const recent = await instance.executeResource(recentRuns());
    expect(recent).toMatchObject({
      data: [{ id: "run-a", job: "Pushed build", status: "Success" }],
    });
  });

  test("runs older than two weeks are deleted when the next one arrives", async () => {
    const blobs = createMemoryBlobStore();
    const bytes = (id: string) =>
      new TextEncoder().encode(
        JSON.stringify(runAt(id, "2026-10-01T00:00:00Z")),
      );
    await archiveRun(blobs, runAt("old", "2026-10-01T00:00:00Z"), bytes("old"));
    const later = new Date(Date.now() + RUN_RETENTION_MS + 60_000);
    await archiveRun(
      blobs,
      runAt("new", "2026-10-30T00:00:00Z"),
      bytes("new"),
      later,
    );
    expect((await blobs.list("runs/")).map((blob) => blob.key)).toEqual([
      "runs/new/run_results.json",
    ]);
  });

  test("however often a pipeline pushes, only the newest runs are kept", async () => {
    const blobs = createMemoryBlobStore();
    for (let index = 0; index < MAX_KEPT_RUNS + 5; index += 1) {
      const id = `run-${index}`;
      await archiveRun(
        blobs,
        runAt(id, "2026-10-30T00:00:00Z"),
        new TextEncoder().encode(
          JSON.stringify(runAt(id, "2026-10-30T00:00:00Z")),
        ),
      );
    }
    const kept = await blobs.list("runs/");
    expect(kept).toHaveLength(MAX_KEPT_RUNS);
    expect(kept.map((blob) => blob.key)).toContain(
      `runs/run-${MAX_KEPT_RUNS + 4}/run_results.json`,
    );
  });

  test("an invocation id cannot name a path outside runs/", () => {
    for (const id of ["../etc", "a/b", "..", "x..y", "  "]) {
      const key = runKey({ metadata: { invocation_id: id } }, "{}");
      expect(key).toMatch(
        /^runs\/[A-Za-z0-9][A-Za-z0-9._-]*\/run_results\.json$/,
      );
      expect(key).not.toContain("..");
    }
    expect(runKey({}, "{}")).toMatch(/^runs\/[0-9a-f]{32}\//);
  });
});
