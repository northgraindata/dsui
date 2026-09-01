import { expect, test } from "bun:test";
import adapter from "../src/index";

test("applies ClickHouse connection defaults", () => {
  const connection = adapter.connectionSchema.parse({ host: "localhost" });
  expect(connection.port).toBe(8123);
  expect(connection.username).toBe("default");
  expect(connection.database).toBeUndefined();
  expect(connection.protocol).toBe("http");
});

test("accepts an optional default database", () => {
  const withDb = adapter.connectionSchema.parse({
    host: "localhost",
    database: "analytics",
  });
  expect(withDb.database).toBe("analytics");
  const withoutDb = adapter.connectionSchema.parse({ host: "localhost" });
  expect(withoutDb.database).toBeUndefined();
});

test("requires a host", () => {
  expect(() => adapter.connectionSchema.parse({})).toThrow();
});

test("declares a bounded query capability", () => {
  expect(
    adapter.capabilities.find((capability) => capability.id === "query")?.view
      .dialect,
  ).toBe("clickhouse");
});

test("exposes ClickHouse monitoring tables as paginated capabilities", () => {
  const capabilities = new Map(
    adapter.capabilities.map((capability) => [capability.id, capability]),
  );

  for (const id of [
    "system-errors",
    "system-events",
    "asynchronous-metrics",
    "disks",
    "settings",
    "detached-parts",
  ]) {
    expect(capabilities.get(id)?.authorization).toBe("inspect");
    expect(capabilities.get(id)?.supportsPagination).toBe(true);
    expect(capabilities.get(id)?.view.kind).toBe("table-browser");
  }
});

test("reads ClickHouse monitoring data from the matching system tables", async () => {
  const statements: string[] = [];
  const instance = adapter.create(
    {
      fetch: (async (_input, init) => {
        statements.push(String(init?.body));
        return new Response(
          JSON.stringify({
            meta: [{ name: "name", type: "String" }],
            data: [{ name: "sample" }],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ host: "clickhouse" }),
  );

  for (const operationId of [
    "system-errors",
    "system-events",
    "asynchronous-metrics",
    "disks",
    "settings",
    "detached-parts",
  ]) {
    expect(await instance.execute(operationId, {})).toEqual({
      items: [["sample"]],
      columns: ["name"],
    });
  }

  expect(statements).toHaveLength(6);
  expect(statements[0]).toContain("FROM system.errors");
  expect(statements[1]).toContain("FROM system.events");
  expect(statements[2]).toContain("FROM system.asynchronous_metrics");
  expect(statements[3]).toContain("FROM system.disks");
  expect(statements[4]).toContain("FROM system.settings");
  expect(statements[5]).toContain("FROM system.detached_parts");
});

test("exposes views, dictionaries, and functions as catalog capabilities", () => {
  const capabilities = new Map(
    adapter.capabilities.map((capability) => [capability.id, capability]),
  );

  for (const id of [
    "views",
    "materialized-views",
    "dictionaries",
    "functions",
  ]) {
    expect(capabilities.get(id)?.authorization).toBe("inspect");
    expect(capabilities.get(id)?.supportsPagination).toBe(true);
    expect(capabilities.get(id)?.view.kind).toBe("table-browser");
  }
});

test("reads ClickHouse catalog extensions from their system tables", async () => {
  const statements: string[] = [];
  const instance = adapter.create(
    {
      fetch: (async (_input, init) => {
        statements.push(String(init?.body));
        return new Response(
          JSON.stringify({
            meta: [{ name: "name", type: "String" }],
            data: [{ name: "sample" }],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ host: "clickhouse" }),
  );

  for (const operationId of [
    "views",
    "materialized-views",
    "dictionaries",
    "functions",
  ]) {
    expect(await instance.execute(operationId, {})).toEqual({
      items: [["sample"]],
      columns: ["name"],
    });
  }

  expect(statements).toHaveLength(4);
  expect(statements[0]).toContain("FROM system.tables");
  expect(statements[0]).toContain(
    "engine IN ('View', 'LiveView', 'WindowView')",
  );
  expect(statements[1]).toContain("engine = 'MaterializedView'");
  expect(statements[2]).toContain("FROM system.dictionaries");
  expect(statements[3]).toContain("FROM system.functions");
});

test("exposes ClickHouse access-control objects as governance capabilities", () => {
  const capabilities = new Map(
    adapter.capabilities.map((capability) => [capability.id, capability]),
  );

  for (const id of [
    "users",
    "roles",
    "grants",
    "row-policies",
    "quotas",
    "settings-profiles",
  ]) {
    expect(capabilities.get(id)?.authorization).toBe("inspect");
    expect(capabilities.get(id)?.supportsPagination).toBe(true);
    expect(capabilities.get(id)?.view.kind).toBe("table-browser");
  }
});

test("reads ClickHouse governance data from access-control system tables", async () => {
  const statements: string[] = [];
  const instance = adapter.create(
    {
      fetch: (async (_input, init) => {
        statements.push(String(init?.body));
        return new Response(
          JSON.stringify({
            meta: [{ name: "name", type: "String" }],
            data: [{ name: "sample" }],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ host: "clickhouse" }),
  );

  for (const operationId of [
    "users",
    "roles",
    "grants",
    "row-policies",
    "quotas",
    "settings-profiles",
  ]) {
    expect(await instance.execute(operationId, {})).toEqual({
      items: [["sample"]],
      columns: ["name"],
    });
  }

  expect(statements).toHaveLength(6);
  expect(statements[0]).toContain("FROM system.users");
  expect(statements[1]).toContain("FROM system.roles");
  expect(statements[2]).toContain("FROM system.grants");
  expect(statements[3]).toContain("FROM system.row_policies");
  expect(statements[4]).toContain("FROM system.quotas");
  expect(statements[5]).toContain("FROM system.settings_profiles");
});

test("declares detail, insight, plan, and parameterized action capabilities", () => {
  const capabilities = new Map(
    adapter.capabilities.map((capability) => [capability.id, capability]),
  );

  expect(capabilities.get("table-detail")?.view.kind).toBe("record-detail");
  expect(capabilities.get("query-detail")?.view.kind).toBe("record-detail");
  expect(capabilities.get("query-insights")?.view.kind).toBe("table-browser");
  expect(capabilities.get("query-plan")?.view.kind).toBe("tree");

  for (const id of [
    "kill-query",
    "create-user",
    "alter-user-password",
    "drop-user",
    "create-role",
    "drop-role",
    "grant-role",
    "revoke-role",
  ]) {
    const capability = capabilities.get(id);
    expect(capability?.authorization).toBe("execute");
    expect(capability?.view.kind).toBe("action-form");
    expect(capability?.view.fields?.length).toBeGreaterThan(0);
  }
});

test("uses typed ClickHouse parameters for details and administrative actions", async () => {
  const requests: Array<{ url: URL; body: string }> = [];
  const instance = adapter.create(
    {
      fetch: (async (input, init) => {
        const url = new URL(String(input));
        const body = String(init?.body);
        requests.push({ url, body });
        if (/^(KILL|CREATE|ALTER|DROP|GRANT|REVOKE)\b/.test(body))
          return new Response("");
        return new Response(
          JSON.stringify({
            meta: [{ name: "name", type: "String" }],
            data: [{ name: "sample" }],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ host: "clickhouse" }),
  );

  await instance.execute("table-detail", {
    database: "analytics",
    table: "events",
  });
  await instance.execute("query-detail", { queryId: "query-123" });
  await instance.execute("kill-query", { queryId: "query-123" });
  await instance.execute("create-user", { name: "reader", password: "s3cret" });
  await instance.execute("alter-user-password", {
    name: "reader",
    password: "new-secret",
  });
  await instance.execute("drop-user", { name: "reader" });
  await instance.execute("create-role", { name: "analyst" });
  await instance.execute("drop-role", { name: "analyst" });
  await instance.execute("grant-role", { role: "analyst", user: "reader" });
  await instance.execute("revoke-role", { role: "analyst", user: "reader" });

  expect(requests[0]?.body).toContain("database = {database:String}");
  expect(requests[0]?.body).toContain("name = {table:String}");
  expect(requests[0]?.url.searchParams.get("param_database")).toBe("analytics");
  expect(requests[0]?.url.searchParams.get("param_table")).toBe("events");
  expect(requests[1]?.body).toContain("query_id = {queryId:String}");
  expect(requests[1]?.url.searchParams.get("param_queryId")).toBe("query-123");
  expect(requests[2]?.body).toBe(
    "KILL QUERY WHERE query_id = {queryId:String} SYNC",
  );
  expect(requests[3]?.body).toContain("{name:Identifier}");
  expect(requests[3]?.body).toContain("{password:String}");
  expect(requests[9]?.body).toBe(
    "REVOKE {role:Identifier} FROM {user:Identifier}",
  );
  expect(requests[9]?.url.searchParams.get("param_role")).toBe("analyst");
  expect(requests[9]?.url.searchParams.get("param_user")).toBe("reader");
});

test("provides query insights and explain plans", async () => {
  const statements: string[] = [];
  const instance = adapter.create(
    {
      fetch: (async (_input, init) => {
        statements.push(String(init?.body));
        return new Response(
          JSON.stringify({
            meta: [{ name: "name", type: "String" }],
            data: [{ name: "sample" }],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ host: "clickhouse" }),
  );

  await instance.execute("query-insights", {});
  await instance.execute("query-plan", { sql: "SELECT 1" });

  expect(statements[0]).toContain("FROM system.query_log");
  expect(statements[0]).toContain("quantile(0.99)");
  expect(statements[1]).toStartWith("EXPLAIN indexes = 1 SELECT 1");
});

test("declares a complete database-to-table explorer surface", () => {
  const capabilities = new Map(
    adapter.capabilities.map((capability) => [capability.id, capability]),
  );

  expect(capabilities.get("explorer")?.view.kind).toBe("database-explorer");
  for (const id of [
    "database-objects",
    "table-overview",
    "table-columns",
    "table-preview",
    "table-ddl",
    "table-parts",
  ]) {
    expect(capabilities.get(id)?.authorization).toBe("inspect");
    expect(capabilities.get(id)?.view.navigation?.parent?.capability).toBe(
      "explorer",
    );
  }
  expect(capabilities.get("table-preview")?.maxPageSize).toBe(1000);
});

test("loads bounded table workspace data with typed parameters", async () => {
  const requests: Array<{ url: URL; body: string }> = [];
  const instance = adapter.create(
    {
      fetch: (async (input, init) => {
        requests.push({
          url: new URL(String(input)),
          body: String(init?.body),
        });
        return new Response(
          JSON.stringify({
            meta: [{ name: "name", type: "String" }],
            data: [{ name: "sample" }],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ host: "clickhouse" }),
  );

  await instance.execute("database-objects", { database: "analytics" });
  await instance.execute("table-overview", {
    database: "analytics",
    table: "events",
  });
  await instance.execute("table-columns", {
    database: "analytics",
    table: "events",
  });
  await instance.execute("table-preview", {
    database: "analytics",
    table: "events",
    limit: 100,
    offset: 200,
  });
  await instance.execute("table-ddl", {
    database: "analytics",
    table: "events",
  });
  await instance.execute("table-parts", {
    database: "analytics",
    table: "events",
    limit: 50,
    offset: 0,
  });

  expect(requests[0]?.body).toContain("FROM system.tables");
  expect(requests[0]?.body).toContain("database = {database:String}");
  expect(requests[2]?.body).toContain("FROM system.columns");
  expect(requests[3]?.body).toContain(
    "FROM {database:Identifier}.{table:Identifier}",
  );
  expect(requests[3]?.url.searchParams.get("param_limit")).toBe("100");
  expect(requests[3]?.url.searchParams.get("param_offset")).toBe("200");
  expect(requests[4]?.body).toContain(
    "SHOW CREATE TABLE {database:Identifier}.{table:Identifier}",
  );
  expect(requests[5]?.body).toContain("FROM system.parts");
  expect(requests[5]?.body).toContain("active");

  await instance.execute("table-ddl", {
    database: "analytics}; DROP DATABASE default; --",
    table: "events}; DROP TABLE system.parts; --",
  });
  expect(requests[6]?.body).toContain(
    "SHOW CREATE TABLE {database:Identifier}.{table:Identifier}",
  );
  expect(requests[6]?.body).not.toContain("DROP DATABASE");
  expect(requests[6]?.url.searchParams.get("param_database")).toBe(
    "analytics}; DROP DATABASE default; --",
  );
  expect(requests[6]?.url.searchParams.get("param_table")).toBe(
    "events}; DROP TABLE system.parts; --",
  );

  await expect(
    instance.execute("table-preview", {
      database: "analytics",
      table: "events",
      limit: 1001,
    }),
  ).rejects.toThrow();
});
