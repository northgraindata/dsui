import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { withAdapterTest } from "@northgraindata/dsui-adapter-test";
import { runQuery } from "./actions/run-query.js";
import { duckdbAdapter } from "./adapter.js";
import { duckdbConnectionMethods } from "./context.js";

test("does not expose read-only configuration for in-memory connections", () => {
  expect(
    Object.keys(
      (
        duckdbConnectionMethods.memory.schema as {
          shape: Record<string, unknown>;
        }
      ).shape,
    ),
  ).not.toContain("readOnly");
});

test("runs an in-memory adapter instance through the public runtime", async () => {
  await withAdapterTest(
    duckdbAdapter,
    { method: "memory" },
    async ({ instance, context }) => {
      expect(context.config).toEqual({ method: "memory" });

      const result = await instance.executeAction(
        runQuery({ sql: "SELECT 42 AS answer" }),
      );

      expect(result).toEqual({
        status: "success",
        data: expect.objectContaining({
          columns: ["answer"],
          columnTypes: ["INTEGER"],
          rows: [{ answer: 42 }],
        }),
      });
    },
  );
});

test("opens a file connection in read-only mode", async () => {
  const path = join(tmpdir(), `dsui-readonly-${crypto.randomUUID()}.duckdb`);
  const seed = await DuckDBInstance.create(path);
  seed.closeSync();

  try {
    await withAdapterTest(
      duckdbAdapter,
      { method: "file", path, readOnly: true },
      async ({ context }) => {
        expect(context.config).toMatchObject({
          method: "file",
          path,
          readOnly: true,
        });
      },
    );
  } finally {
    await rm(path, { force: true });
  }
});
