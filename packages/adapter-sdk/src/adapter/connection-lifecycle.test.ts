import { expect, test } from "bun:test";
import { z } from "zod";
import { defineAdapter } from "./define";

const base = {
  metadata: { id: "lifecycle-test", name: "Lifecycle", version: "1.0.0" },
  health: async () => ({ status: "healthy" as const, score: 100, checks: [] }),
};

test("context retention defaults to request scope and supports grouped methods", () => {
  const adapter = defineAdapter({
    ...base,
    connectionMethods: {
      file: { label: "File", schema: z.object({}) },
      remote: {
        label: "Remote",
        methods: {
          api: {
            label: "API",
            schema: z.object({}),
            contextIdleTimeoutMs: 600_000,
          },
        },
      },
    },
  });
  expect(
    adapter.connectionMethods?.map(({ id, contextIdleTimeoutMs }) => ({
      id,
      contextIdleTimeoutMs,
    })),
  ).toEqual([
    { id: "file", contextIdleTimeoutMs: 0 },
    { id: "api", contextIdleTimeoutMs: 600_000 },
  ]);
});

for (const timeout of [
  -1,
  0.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  2_147_483_648,
]) {
  test(`rejects an invalid context idle timeout: ${timeout}`, () => {
    expect(() =>
      defineAdapter({
        ...base,
        connectionMethods: {
          api: {
            label: "API",
            schema: z.object({}),
            contextIdleTimeoutMs: timeout,
          },
        },
      }),
    ).toThrow("contextIdleTimeoutMs");
  });
}
