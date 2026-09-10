import { expect, test } from "bun:test";
import { createAdapterInstance } from "@northgraindata/dsui-adapter-sdk";
import { restartExtension } from "../src/actions/config";
import adapter from "../src/adapter";
import { createDuckDbClient } from "../src/duckdb-client";

test("restart requires explicit confirmation before any database work", () => {
  expect(() =>
    // @ts-expect-error Runtime input must reject an unconfirmed restart too.
    restartExtension({ name: "httpfs", mode: "unload", confirmed: false }),
  ).toThrow();
});

test("built-in extensions cannot be unloaded and rejection preserves database state", async () => {
  const client = createDuckDbClient({ method: "memory" });
  try {
    await client.execute("CREATE TABLE preserved AS SELECT 42 AS n");
    await expect(client.restartExtension("json", "unload")).rejects.toThrow(
      "built-in",
    );
    expect((await client.execute("SELECT n FROM preserved")).rows).toEqual([
      { n: 42 },
    ]);
  } finally {
    client.dispose();
  }
});

test("unknown extension actions fail without resetting the instance", async () => {
  const instance = await createAdapterInstance(adapter, { method: "memory" });
  try {
    const result = await instance.executeAction(
      restartExtension({
        name: "missing_extension",
        mode: "reload",
        confirmed: true,
      }),
    );
    expect(result.status).toBe("error");
  } finally {
    await instance.dispose();
  }
});
