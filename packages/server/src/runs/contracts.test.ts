import { describe, expect, test } from "bun:test";
import {
  assertValidRunTransition,
  type IdempotencyRecord,
  isValidRunTransition,
  type Run,
  type RunRequest,
  resolveStartRetry,
  startRunRequestFingerprint,
} from "./contracts.js";

const request: RunRequest = {
  command: "build",
  project: { path: "/workspace/project" },
  profile: { name: "dev", target: "local" },
  args: { selector: ["orders", "customers"], fullRefresh: false },
  idempotencyKey: "intent-1",
};
const { idempotencyKey: _, ...requestIntent } = request;

const run = (state: Run["state"]): Run => ({
  invocationId: "invocation-1",
  request: requestIntent,
  state,
  createdAt: "2026-01-01T00:00:00.000Z",
  cancellable: state === "queued" || state === "running",
  retryable: state === "failed",
});

describe("run lifecycle contract", () => {
  test("accepts only the declared monotonic transitions", () => {
    expect(isValidRunTransition("queued", "running")).toBe(true);
    expect(isValidRunTransition("running", "failed")).toBe(true);
    expect(isValidRunTransition("running", "cancelled")).toBe(false);
    expect(isValidRunTransition("succeeded", "running")).toBe(false);
    expect(() => assertValidRunTransition("cancelled", "queued")).toThrow(
      "Invalid run transition",
    );
  });

  test("replays matching completed starts and marks matching active starts in flight", () => {
    const record: IdempotencyRecord = {
      requestFingerprint: startRunRequestFingerprint(request),
      run: run("succeeded"),
    };
    expect(resolveStartRetry(request, record)).toBe("replayed");
    expect(
      resolveStartRetry({ ...request, idempotencyKey: "retry" }, record),
    ).toBe("replayed");
    expect(resolveStartRetry(request, { ...record, run: run("running") })).toBe(
      "in_flight",
    );
  });

  test("rejects the same key when its intent changes", () => {
    const record: IdempotencyRecord = {
      requestFingerprint: startRunRequestFingerprint(request),
      run: run("queued"),
    };
    expect(resolveStartRetry({ ...request, command: "test" }, record)).toBe(
      "conflict",
    );
    expect(resolveStartRetry(request, undefined)).toBe("created");
  });
});
