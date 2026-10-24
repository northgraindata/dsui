import { expect, test } from "bun:test";
import {
  createAdapterInstance,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "./actions.js";
import { createSnowflakeAdapter } from "./adapter.js";
import {
  quoteIdentifier,
  type SnowflakeClient,
  snowflakeConnectionOptions,
} from "./client.js";
import { databases, previewRows, warehouses } from "./resources.js";

test("quotes each Snowflake identifier as a single name", () => {
  expect(quoteIdentifier('a.b"c')).toBe('"a.b""c"');
  expect(() => quoteIdentifier("")).toThrow("Identifier cannot be empty");
});

test("Snowflake driver leaves adapter-host stdout for JSON-RPC", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      'import "./src/client.ts"; import snowflake from "snowflake-sdk"; snowflake.createConnection({ account: "example-example", username: "test", password: "test" });',
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode, stderr).toBe(0);
  expect(stdout).toBe("");
});

test("adapter resources and query action stay inside the SDK contract", async () => {
  const queries: Array<{ warehouse: string; sql: string; maxRows: number }> =
    [];
  let disposed = false;
  const selectedConnections: string[] = [];
  const client: SnowflakeClient = {
    serverInfo: async () => ({
      account: "test",
      database: "ANALYTICS",
      warehouse: "WH",
      role: "ANALYST",
      version: "1",
    }),
    listDatabases: async () => [
      { name: "ANALYTICS", owner: "ANALYST", createdOn: null },
    ],
    listWarehouses: async () => [
      { name: "WH", size: "X-Small", state: "STARTED", autoSuspend: 60 },
      { name: "OTHER", size: "Small", state: "SUSPENDED", autoSuspend: 60 },
    ],
    listSchemas: async (database) => [
      { database, name: "PUBLIC", owner: "ANALYST" },
    ],
    listRelations: async (database, schema) => [
      { database, schema, name: "EVENTS", kind: "BASE TABLE", rowCount: 1 },
    ],
    listColumns: async () => [
      {
        name: "ID",
        position: 1,
        type: "NUMBER",
        nullable: false,
        defaultValue: null,
      },
    ],
    preview: async () => [{ ID: 1 }],
    execute: async (sql, maxRows) => {
      queries.push({ warehouse: "WH", sql, maxRows });
      return { columns: ["ID"], rows: [{ ID: 1 }], rowCount: 1 };
    },
    selectWarehouse: async (warehouse) => {
      selectedConnections.push(warehouse);
    },
    dispose: async () => {
      disposed = true;
    },
  };
  const otherClient: SnowflakeClient = {
    ...client,
    execute: async (sql, maxRows) => {
      queries.push({ warehouse: "OTHER", sql, maxRows });
      return { columns: ["ID"], rows: [{ ID: 2 }], rowCount: 1 };
    },
  };
  const adapter = createSnowflakeAdapter(async (config) =>
    config.warehouse === "OTHER" ? otherClient : client,
  );
  const instance = await createAdapterInstance(adapter, {
    method: "password",
    account: "test",
    username: "test-user",
    password: "test-password",
    database: "ANALYTICS",
  });
  try {
    const databaseResult = await instance.executeResource(databases());
    expect(databaseResult.status).toBe("success");
    if (databaseResult.status === "success")
      expect(databaseResult.data[0]?.name).toBe("ANALYTICS");

    const warehouseResult = await instance.executeResource(warehouses());
    expect(warehouseResult.status).toBe("success");
    if (warehouseResult.status === "success")
      expect(warehouseResult.data[0]?.name).toBe("WH");

    const previewResult = await instance.executeResource(
      previewRows({
        database: "ANALYTICS",
        schema: "PUBLIC",
        relation: "EVENTS",
      }),
    );
    expect(previewResult.status).toBe("success");
    if (previewResult.status === "success")
      expect(previewResult.data).toEqual([{ ID: 1 }]);

    const actionResult = await instance.executeAction(
      runQuery({ sql: "select 1 as ID", database: "OTHER", maxRows: 5 }),
    );
    expect(actionResult.status).toBe("success");
    expect(queries).toEqual([
      { warehouse: "OTHER", sql: "select 1 as ID", maxRows: 5 },
    ]);
    expect(selectedConnections).toEqual(["WH"]);

    const scope = instance.createPageScope("/query?sql=select%201");
    const nodes = serializeNodes(scope.render());
    const editor = nodes.find(
      (node) =>
        node.kind === "custom" && node.props.component === "query-editor",
    );
    expect(editor?.props.props.value).toBe("select 1");
    expect(editor?.props.props.database.label).toBe("Warehouse");
    scope.dispose();
  } finally {
    await instance.dispose();
  }
  expect(disposed).toBe(true);
});

test("JWT and password are the Snowflake connection methods", async () => {
  const adapter = createSnowflakeAdapter();
  expect(adapter.connectionMethods?.map((method) => method.id)).toEqual([
    "jwt",
    "password",
  ]);
  const password = adapter.connectionSchema?.safeParse({
    method: "password",
    account: "test",
    username: "test-user",
    password: "test-password",
    database: "ANALYTICS",
  });
  expect(password?.success).toBe(true);
  const jwt = adapter.connectionSchema?.safeParse({
    method: "jwt",
    account: "test",
    username: "test-user",
    privateKeyPath: "/path/to/rsa_key.p8",
    database: "ANALYTICS",
  });
  expect(jwt?.success).toBe(true);
  expect(
    snowflakeConnectionOptions({
      method: "password",
      account: "test",
      username: "test-user",
      password: "test-password",
      database: "ANALYTICS",
      schema: "PUBLIC",
      application: "DSUI",
    }),
  ).toMatchObject({
    authenticator: "SNOWFLAKE",
    username: "test-user",
    password: "test-password",
  });
  expect(
    snowflakeConnectionOptions({
      method: "jwt",
      account: "test",
      username: "test-user",
      privateKeyPath: "/path/to/rsa_key.p8",
      database: "ANALYTICS",
      schema: "PUBLIC",
      application: "DSUI",
    }),
  ).toMatchObject({
    authenticator: "SNOWFLAKE_JWT",
    privateKeyPath: "/path/to/rsa_key.p8",
  });
});
