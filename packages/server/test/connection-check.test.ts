import { expect, test } from "bun:test";
import { inspectConnection } from "../src/cli/connection-check";

test("a connection check uses the real backend and only declared read resources", async () => {
  const calls: string[] = [];
  const result = await inspectConnection(
    {
      validateConnection: (raw) => raw,
      checkHealth: () =>
        Promise.resolve({
          checkedAt: new Date().toISOString(),
          status: "healthy",
          latencyMs: 7,
        }),
      executeResource: (id, connection) => {
        calls.push(id);
        expect(connection).toEqual({ host: "warehouse" });
        return Promise.resolve({ data: [{ schema: "reporting", tables: 4 }] });
      },
    },
    { host: "warehouse" },
    ["schema-table-counts", "undeclared"],
    ["schema-table-counts"],
  );
  expect(result).toEqual({
    latencyMs: 7,
    metadata: { "schema-table-counts": [{ schema: "reporting", tables: 4 }] },
  });
  expect(calls).toEqual(["schema-table-counts"]);
});

test("a failed real health check cannot produce success or discovery data", async () => {
  let reads = 0;
  await expect(
    inspectConnection(
      {
        validateConnection: (v) => v,
        checkHealth: () =>
          Promise.resolve({
            checkedAt: new Date().toISOString(),
            status: "unavailable",
            detail: "password=do-not-show",
          }),
        executeResource: () => {
          reads += 1;
          return Promise.resolve({ data: [] });
        },
      },
      {},
      ["overview"],
      ["overview"],
    ),
  ).rejects.toThrow("Could not connect");
  expect(reads).toBe(0);
});

test("metadata permission failures remain explicit, without invented objects", async () => {
  const result = await inspectConnection(
    {
      validateConnection: (v) => v,
      checkHealth: () =>
        Promise.resolve({
          checkedAt: new Date().toISOString(),
          status: "healthy",
        }),
      executeResource: () =>
        Promise.reject(new Error("Access denied password=secret")),
    },
    {},
    ["overview"],
    ["overview"],
  );
  expect(result.metadata).toEqual({ overview: { unavailable: true } });
  expect(JSON.stringify(result)).not.toContain("secret");
});
