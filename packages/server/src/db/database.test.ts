import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import type { Run, RunArtifact, RunRequest } from "../runs/contracts";
import { DsuiDatabase } from "./database";

const databases: DsuiDatabase[] = [];
const request: RunRequest = {
  command: "build",
  project: { path: "/workspace/project" },
  environment: { TOKEN: { value: "do-not-store" } },
  idempotencyKey: "intent-1",
};

function makeRun(state: Run["state"] = "queued"): Run {
  const { idempotencyKey: _, ...intent } = request;
  return {
    invocationId: "invocation-1",
    request: intent,
    state,
    createdAt: "2026-01-01T00:00:00.000Z",
    cancellable: state === "queued" || state === "running",
    retryable: state === "failed",
  };
}

function database(path = ":memory:"): DsuiDatabase {
  const db = new DsuiDatabase(path);
  databases.push(db);
  return db;
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("run persistence", () => {
  test("atomically claims duplicate and conflicting starts without storing secrets", () => {
    const db = database();
    const first = db.claimStartIdempotency(
      "intent-1",
      "fingerprint-1",
      makeRun(),
    );
    const duplicate = db.claimStartIdempotency("intent-1", "fingerprint-1", {
      ...makeRun(),
      invocationId: "invocation-2",
    });
    const conflict = db.claimStartIdempotency("intent-1", "fingerprint-2", {
      ...makeRun(),
      invocationId: "invocation-3",
    });

    expect(first.outcome).toBe("claimed");
    expect(duplicate).toMatchObject({
      outcome: "existing",
      requestFingerprint: "fingerprint-1",
    });
    expect(conflict).toEqual({
      outcome: "conflict",
      reason: "idempotency_key_reused",
    });
    expect(db.loadRun("invocation-2")).toBeNull();
    expect(JSON.stringify(db.loadRun("invocation-1"))).not.toContain(
      "do-not-store",
    );
  });

  test("persists terminal state and events in cursor order", () => {
    const db = database();
    db.saveRun(makeRun());
    db.appendRunEvent("invocation-1", {
      type: "started",
      at: "2026-01-01T00:00:01.000Z",
    });
    db.appendRunEvent("invocation-1", {
      type: "log",
      at: "2026-01-01T00:00:02.000Z",
      message: "hello",
    });
    db.appendRunEvent("invocation-1", {
      type: "completed",
      at: "2026-01-01T00:00:03.000Z",
      state: "succeeded",
      exitCode: 0,
    });

    const firstPage = db.listRunEvents("invocation-1", undefined, 2);
    const secondPage = db.listRunEvents(
      "invocation-1",
      firstPage.nextCursor,
      2,
    );
    expect(firstPage.events.map((event) => event.type)).toEqual([
      "started",
      "log",
    ]);
    expect(secondPage.events.map((event) => event.type)).toEqual(["completed"]);
    expect(db.loadRun("invocation-1")?.state).toBe("succeeded");
    expect(() =>
      db.appendRunEvent("invocation-1", {
        type: "started",
        at: "2026-01-01T00:00:04.000Z",
      }),
    ).toThrow("Invalid run transition");
  });

  test("lists and gets discovered artifacts", () => {
    const db = database();
    db.saveRun(makeRun("running"));
    const artifact: RunArtifact = {
      artifactId: "manifest",
      kind: "manifest",
      contentType: "application/json",
      invocationId: "invocation-1",
      location: { kind: "local", ref: "/tmp/manifest.json" },
      downloadable: true,
    };
    db.appendRunEvent("invocation-1", {
      type: "artifact_discovered",
      at: "2026-01-01T00:00:01.000Z",
      artifact,
    });
    expect(db.listRunArtifacts("invocation-1")).toEqual([artifact]);
    expect(db.getRunArtifact("invocation-1", "manifest")).toEqual(artifact);
  });

  test("shares a file-backed schema across database handles", () => {
    const path = `/tmp/dsui-run-persistence-${crypto.randomUUID()}.sqlite`;
    const first = database(path);
    first.saveRun(makeRun("failed"));
    const second = database(path);
    expect(second.loadRun("invocation-1")?.state).toBe("failed");
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
  });
});
