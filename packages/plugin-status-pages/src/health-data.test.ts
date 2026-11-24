import { expect, test } from "bun:test";
import type { PluginCapabilityCatalog } from "@northgraindata/dsui-plugin-sdk";
import { type HealthData, readHealth } from "./health-data";

function fixture(ready: boolean, value: unknown, failure = false) {
  let queries = 0;
  const warnings: string[] = [];
  const plugins: PluginCapabilityCatalog = {
    get: async () =>
      ready
        ? {
            id: "health",
            name: "Service health",
            version: "1",
            status: "ready",
          }
        : null,
    list: async () => [],
    listActions: async () => [],
    listResources: async () => [],
    executeAction: async () => {
      throw new Error("No actions expected");
    },
    queryResource: async (id, resource) => {
      expect([id, resource]).toEqual(["health", "status-history"]);
      queries++;
      if (failure) throw new Error("offline");
      return value;
    },
  };
  return {
    context: {
      plugins,
      logger: {
        info: () => undefined,
        error: () => undefined,
        warn: (message: string) => {
          warnings.push(message);
        },
      },
    },
    warnings,
    queries: () => queries,
  };
}
test("without Health no source is queried", async () => {
  const f = fixture(false, null);
  expect(await readHealth(f.context)).toEqual({ data: undefined });
  expect(f.queries()).toBe(0);
});
test("recorded health is validated before rendering", async () => {
  const value: HealthData = {
    version: 1,
    services: [
      { id: "warehouse", health: "healthy", maintenance: false, days: [] },
    ],
  };
  const f = fixture(true, value);
  expect((await readHealth(f.context)).data).toEqual(value);
});
for (const failure of [false, true])
  test(`an installed source failure is visible (${failure ? "request" : "contract"})`, async () => {
    const f = fixture(true, { version: 999 }, failure);
    const result = await readHealth(f.context);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain("temporarily unavailable");
    expect(f.warnings).toHaveLength(1);
  });
