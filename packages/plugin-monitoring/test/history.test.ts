import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readWindow,
  recentOperations,
  recordOperations,
  recordSample,
} from "../src/stores/history.js";

test("SQLite history expires old samples and bounds chart output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-history-"));
  const db = new Database(join(directory, "history.sqlite"));
  const storage = { openDatabase: () => db };
  try {
    const now = Date.now();
    recordSample(storage, {
      time: now - 8 * 86400000,
      cpu: 1,
      memory: 20,
      disk: null,
    });
    for (let i = 0; i < 1000; i++)
      recordSample(storage, {
        time: now - i * 10000,
        cpu: 2,
        memory: 40,
        disk: null,
      });
    const result = readWindow(storage, "cpu", 7 * 86400, "7d");
    expect(result.sampleCount).toBe(1000);
    expect(result.points.length).toBeLessThanOrEqual(401);
    expect(result.points.every((point) => point.value === 2)).toBe(true);
    expect(readWindow(storage, "disk", 3600, "1h").points).toEqual([]);
    const operation = {
      id: "one",
      adapterId: "test",
      serviceId: "service",
      kind: "resource",
      startedAt: now,
      durationMs: 10,
      outcome: "active" as const,
    };
    recordOperations(storage, [operation]);
    recordOperations(storage, [
      { ...operation, outcome: "error", durationMs: 30 },
    ]);
    recordOperations(storage, [operation]);
    expect(recentOperations(storage)[0].outcome).toBe("error");
    expect(recentOperations(storage)[0].durationMs).toBe(30);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
