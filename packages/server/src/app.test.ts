import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "./app.js";
import type { DsuiConfig } from "./config.js";

const runtimes: Array<ReturnType<typeof createRuntime>> = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
});

function runtime(config?: DsuiConfig) {
  const instance = createRuntime({
    config,
    databasePath: join(tmpdir(), `dsui-app-${randomUUID()}.sqlite`),
  });
  runtimes.push(instance);
  return instance;
}

describe("runtime adapter registration", () => {
  test("includes dbt in the bundled default adapters", async () => {
    const instance = runtime({ services: [] });

    await instance.refreshConfig();

    expect(instance.registry.list().map((adapter) => adapter.id)).toEqual([
      "airflow",
      "duckdb",
      "dbt",
      "snowflake",
    ]);
  });

  test("loads explicitly configured adapters", async () => {
    const instance = runtime({
      services: [],
      adapters: {
        snowflake: {
          package: "@northgraindata/dsui-adapter-snowflake",
        },
      },
    });

    await instance.refreshConfig();

    expect(instance.registry.list().map((adapter) => adapter.id)).toEqual([
      "snowflake",
    ]);
  });
});
