import { expect, test } from "bun:test";
import type { AdapterBackend } from "../src/adapters/types.js";
import { createOperationDiagnostics } from "../src/diagnostics/operations.js";

test("diagnostics track active, completed and failed work without payloads", async () => {
  const diagnostics = createOperationDiagnostics();
  let finish: ((value: { data: unknown }) => void) | undefined;
  const backend: AdapterBackend = {
    validateConnection: (value) => value,
    checkHealth: async () => {
      throw new Error("private connection error");
    },
    renderPage: async () => {
      throw new Error("unused");
    },
    executeResource: async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    executeAction: async () => ({
      result: { status: "error", message: "private SQL" },
      emissions: [],
    }),
    executeJob: async () => [],
    executeRoute: async () => ({ status: 200, headers: {}, emissions: [] }),
  };
  const observed = diagnostics.wrap("adapter", backend);
  expect(diagnostics.wrap("adapter", observed)).toBe(observed);
  const pending = observed.executeResource(
    "private query",
    { password: "secret" },
    { sql: "private SQL" },
    { persistenceNamespace: "service" },
  );
  expect((await diagnostics.snapshot()).operations[0]).toMatchObject({
    adapterId: "adapter",
    serviceId: "service",
    outcome: "active",
    kind: "resource",
  });
  finish?.({ data: "private result" });
  await pending;
  await expect(observed.checkHealth({})).rejects.toThrow(
    "private connection error",
  );
  await observed.executeAction("action", {}, {});
  const snapshot = await diagnostics.snapshot();
  expect(snapshot.operations.map((entry) => entry.outcome)).toEqual([
    "success",
    "error",
    "error",
  ]);
  expect(JSON.stringify(snapshot)).not.toContain("private");
  expect(JSON.stringify(snapshot)).not.toContain("secret");
});
