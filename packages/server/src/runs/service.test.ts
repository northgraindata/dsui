import { afterEach, describe, expect, test } from "bun:test";
import { ProcessRunnerError } from "@northgraindata/dsui-process-runner";
import { DsuiDatabase } from "../db/database.js";
import type { Run, RunEvent, StartRunRequest } from "./contracts.js";
import {
  DurableRunService,
  type RunExecutor,
  type RunExecutorRequest,
} from "./service.js";

const databases: DsuiDatabase[] = [];

const request: StartRunRequest = {
  command: "build",
  project: { path: "/workspace/project" },
  environment: { TOKEN: { value: "secret-value" } },
  timeoutMs: 10_000,
  idempotencyKey: "start-1",
};

function database(): DsuiDatabase {
  const database = new DsuiDatabase(":memory:");
  databases.push(database);
  return database;
}

async function waitFor(
  service: DurableRunService,
  invocationId: string,
  state: Run["state"],
): Promise<Run> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await service.getRun({ invocationId });
    if (run.state === state) return run;
    await Bun.sleep(1);
  }
  throw new Error(`Run did not reach ${state}`);
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("durable run service", () => {
  test("claims starts atomically and persists redacted output, status, and completion", async () => {
    const db = database();
    const events: RunEvent[] = [];
    const executor: RunExecutor = {
      async execute({ onOutput }: RunExecutorRequest) {
        const output = {
          type: "output" as const,
          at: new Date().toISOString(),
          stream: "stdout" as const,
          text: "safe output secret-value",
        };
        events.push(output);
        onOutput(output);
        return {
          exitCode: 0,
          durationMs: 12,
          providerStatus: { provider: "test", status: "done", code: "OK" },
        };
      },
    };
    const service = new DurableRunService(db, executor);
    const created = await service.startRun(request);
    if (created.outcome !== "created") throw new Error("expected created run");
    const replay = await service.startRun(request);
    expect(["in_flight", "replayed"]).toContain(replay.outcome);
    const run = await waitFor(service, created.run.invocationId, "succeeded");
    expect(run.providerStatus).toEqual({
      provider: "test",
      status: "done",
      code: "OK",
    });
    expect(events).toHaveLength(1);
    expect(
      (
        await service.listRunEvents({ invocationId: run.invocationId })
      ).events.map((event) => event.type),
    ).toEqual(["started", "output", "completed"]);
    expect(
      (await service.listRunEvents({ invocationId: run.invocationId }))
        .events[1],
    ).toMatchObject({ text: "safe output [REDACTED]" });
    expect(JSON.stringify(db.loadRun(run.invocationId))).not.toContain(
      "secret-value",
    );
  });

  test("maps nonzero exits to failed and runner cancellation/timeout to terminal states", async () => {
    let mode: "failed" | "cancelled" | "timed_out" = "failed";
    const executor: RunExecutor = {
      async execute({ signal }) {
        if (mode === "failed") return { exitCode: 3 };
        return new Promise<never>((_, reject) => {
          signal.addEventListener(
            "abort",
            () =>
              reject(
                new ProcessRunnerError(
                  mode === "cancelled" ? "CANCELLED" : "TIMEOUT",
                  mode,
                ),
              ),
            { once: true },
          );
        });
      },
    };
    const service = new DurableRunService(database(), executor);
    const failed = await service.startRun({
      ...request,
      idempotencyKey: "failed",
    });
    if (failed.outcome !== "created") throw new Error("expected created run");
    expect(
      (await waitFor(service, failed.run.invocationId, "failed")).retryable,
    ).toBe(true);

    mode = "cancelled";
    const cancelled = await service.startRun({
      ...request,
      idempotencyKey: "cancelled",
    });
    if (cancelled.outcome !== "created")
      throw new Error("expected created run");
    await service.cancelRun({
      invocationId: cancelled.run.invocationId,
      idempotencyKey: "cancel-1",
    });
    expect(
      (await waitFor(service, cancelled.run.invocationId, "cancelled"))
        .cancellable,
    ).toBe(false);

    mode = "timed_out";
    const timedOut = await service.startRun({
      ...request,
      idempotencyKey: "timeout",
    });
    if (timedOut.outcome !== "created") throw new Error("expected created run");
    await service.cancelRun({
      invocationId: timedOut.run.invocationId,
      idempotencyKey: "cancel-2",
    });
    expect(
      (await waitFor(service, timedOut.run.invocationId, "timed_out")).state,
    ).toBe("timed_out");
  });

  test("validates requests, bounds local artifacts, and fails active work on construction", async () => {
    const db = database();
    db.saveRun({
      invocationId: "old-run",
      request: { command: "build", project: { path: "/old" } },
      state: "running",
      createdAt: new Date(Date.now() - 1000).toISOString(),
      cancellable: true,
      retryable: false,
    });
    const service = new DurableRunService(db, {
      execute: async () => ({ exitCode: 0 }),
    });
    expect((await service.getRun({ invocationId: "old-run" })).state).toBe(
      "failed",
    );
    expect(
      (await service.listRunEvents({ invocationId: "old-run" })).events[0]
        ?.type,
    ).toBe("error");
    await expect(
      service.startRun({ ...request, idempotencyKey: " " }),
    ).rejects.toThrow("non-empty");
    await expect(
      service.startRun({ ...request, timeoutMs: 0 }),
    ).rejects.toThrow("positive");
    await expect(
      service.startRun({ ...request, project: { path: " " } }),
    ).rejects.toThrow("non-empty");
  });
});
