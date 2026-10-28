import { expect, test } from "bun:test";
import {
  type ActionRuntimeContext,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import { tableCommand } from "../src/actions";
import { createClickHouseAdapter } from "../src/adapter";
import type { ClickHouseClient, QueryResult } from "../src/client";
import { connectionSchema } from "../src/config";
import { queryPage, tablePage } from "../src/pages";
import { inspectSystem, preview } from "../src/resources";

const config = connectionSchema.parse({
  method: "structured",
  host: "localhost",
});
const empty = (): QueryResult => ({
  columns: [],
  columnTypes: [],
  rows: [],
  rowCount: 0,
  queryId: "id",
});
function fakeClient(
  execute: ClickHouseClient["execute"] = async () => empty(),
): ClickHouseClient {
  return { execute, cancel: async () => [], dispose: async () => undefined };
}
const noStores = {
  use() {
    throw new Error("No store expected");
  },
  get() {
    throw new Error("No store expected");
  },
};

test("initialization failure disposes its client; health only requires authenticated SQL", async () => {
  let disposed = 0;
  const adapter = createClickHouseAdapter(() => ({
    ...fakeClient(async () => {
      throw new Error("denied");
    }),
    dispose: async () => {
      disposed++;
    },
  }));
  await expect(adapter.createContext(config)).rejects.toThrow("denied");
  expect(disposed).toBe(1);
  const healthy = createClickHouseAdapter(() => fakeClient());
  const ctx = await healthy.createContext(config);
  expect((await healthy.health(ctx)).status).toBe("healthy");
  expect(
    healthy.connectionMethods?.every(
      (method) => method.contextIdleTimeoutMs === 300_000,
    ),
  ).toBe(true);
});

test("query and relation pages compose shared components and deep links never execute", () => {
  const nodes = serializeNodes(
    queryPage.render({
      params: {},
      query: new URLSearchParams({ sql: "SELECT 42" }),
      stores: noStores,
    }),
  );
  const editor = nodes.find(
    (node) => node.kind === "custom" && node.props.component === "query-editor",
  );
  expect(editor?.props.props.value).toBe("SELECT 42");
  const relation = serializeNodes(
    tablePage.render({
      params: { database: "db", table: "events" },
      query: new URLSearchParams(),
      stores: noStores,
    }),
  );
  expect(JSON.stringify(relation)).toContain("resource-tree");
  expect(JSON.stringify(relation)).toContain("inspect-parts");
  expect(JSON.stringify(relation)).not.toContain("schema:");
});

test("inspection adapts to available columns and binds filters", async () => {
  const calls: { sql: string; params: unknown }[] = [];
  const client = fakeClient(async (sql, options) => {
    calls.push({ sql, params: options?.params });
    if (sql.startsWith("SELECT name"))
      return {
        ...empty(),
        rows: [{ name: "database" }, { name: "table" }, { name: "rows" }],
      };
    return empty();
  });
  await inspectSystem(
    "parts",
    { client, config },
    { database: "a'b", table: "events" },
  );
  expect(calls[1].sql).toContain("SELECT `database`, `table`, `rows`");
  expect(calls[1].sql).not.toContain("a'b");
  expect(calls[1].params).toEqual({ database: "a'b", table: "events" });
});

test("table management requires matching confirmation and rejects read-only mode", async () => {
  const runtime: ActionRuntimeContext = {
    invalidate: () => undefined,
    emit: () => undefined,
    stores: {
      get: () => {
        throw new Error("No stores expected");
      },
    },
  };
  const ctx = { ...runtime, client: fakeClient(), config };
  await expect(
    tableCommand.definition.run(
      { database: "db", table: "t", operation: "drop", confirmTarget: "wrong" },
      ctx,
    ),
  ).rejects.toThrow("confirm");
  await expect(
    tableCommand.definition.run(
      { database: "db", table: "t", operation: "drop", confirmTarget: "db.t" },
      { ...ctx, config: { ...config, readOnly: true } },
    ),
  ).rejects.toThrow("read-only");
});

test("setting inspection redacts credential values even for privileged roles", async () => {
  const client = fakeClient(async (sql) =>
    sql.startsWith("SELECT name")
      ? { ...empty(), rows: [{ name: "name" }, { name: "value" }] }
      : {
          ...empty(),
          rows: [
            { name: "s3_secret_access_key", value: "fixture-secret" },
            { name: "max_threads", value: "4" },
          ],
        },
  );
  expect(await inspectSystem("settings", { client, config })).toEqual([
    { name: "s3_secret_access_key", value: "[redacted]" },
    { name: "max_threads", value: "4" },
  ]);
});

test("table preview supplies the row array consumed by the shared Table", async () => {
  const rows = [{ id: "9007199254740993", label: null }];
  const client = fakeClient(async (sql, options) => {
    expect(sql).toBe("SELECT * FROM `demo`.`orders` LIMIT 100");
    expect(options).toEqual({ database: "demo", maxRows: 100 });
    return { ...empty(), rows, rowCount: 1 };
  });
  expect(
    await preview.definition.query(
      { database: "demo", table: "orders" },
      { client, config },
    ),
  ).toEqual(rows);
});

test("navigation only exposes overview, data, query and activity pages", () => {
  const adapter = createClickHouseAdapter(() => fakeClient());
  expect(adapter.pages.map((page) => page.path)).toEqual([
    "/",
    "/data",
    "/data/:database",
    "/data/:database/:table",
    "/query",
    "/query/:database",
    "/activity",
  ]);
});
