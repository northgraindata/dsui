import { expect, test } from "bun:test";
import {
  type ComponentNode,
  createAdapterInstance,
} from "@northgraindata/dsui-adapter-sdk";
import { executeProcedure } from "../src/actions/ingestion.js";
import { cancelQuery, runQuery } from "../src/actions/run-query.js";
import { resumeTask, runTask, suspendTask } from "../src/actions/tasks.js";
import {
  createWarehouse,
  suspendWarehouse,
} from "../src/actions/warehouses.js";
import { createSnowflakeAdapter, snowflakeAdapter } from "../src/adapter.js";
import { SessionBar } from "../src/components/session-bar.js";
import { createFakeSnowflakeClient } from "../src/fake-client.js";
import { logs } from "../src/resources/logs.js";
import { queries } from "../src/resources/queries.js";
import { tasks } from "../src/resources/tasks.js";
import { warehouses } from "../src/resources/warehouses.js";
import { queryEditorStore } from "../src/stores/query-editor.js";
import { queryFiltersStore } from "../src/stores/query-filters.js";
import { sessionStore } from "../src/stores/session.js";

const CONFIG = { accountIdentifier: "org-account", token: "test-token" };

// Explicit fake injection: the default adapter contacts Snowflake, so every
// test below runs against an isolated in-memory client instead.
function testAdapter() {
  return createSnowflakeAdapter(() => createFakeSnowflakeClient());
}

function nodes(scope: {
  render(): ComponentNode | readonly ComponentNode[];
}): ComponentNode[] {
  const rendered = scope.render();
  return isNodeList(rendered) ? [...rendered] : [rendered];
}

function isNodeList(
  value: ComponentNode | readonly ComponentNode[],
): value is readonly ComponentNode[] {
  return !("kind" in (value as ComponentNode));
}

test("snowflake adapter composes all primitives", () => {
  expect(snowflakeAdapter.metadata.id).toBe("snowflake");
  expect(snowflakeAdapter.stores.map((s) => s.id)).toEqual([
    "session",
    "query-filters",
    "query-editor",
    "log-filters",
  ]);
  for (const id of [
    "databases",
    "database-details",
    "schemas",
    "tables",
    "table-details",
    "table-columns",
    "table-preview",
    "table-ddl",
    "views",
    "view-details",
    "sequences",
    "materialized-views",
    "file-formats",
    "stages",
    "stage-files",
    "streams",
    "copy-history",
    "dynamic-tables",
    "pipes",
    "functions",
    "procedures",
    "warehouses",
    "warehouse-details",
    "compute-pools",
    "queries",
    "query-details",
    "query-results",
    "tasks",
    "task-details",
    "task-history",
    "logs",
    "users",
    "user-details",
    "roles",
    "grants",
    "warehouse-spend",
    "budgets",
    "resource-monitors",
    "access-history",
    "account-details",
  ])
    expect(snowflakeAdapter.resources.map((r) => r.id)).toContain(id);
  for (const id of [
    "run-query",
    "cancel-query",
    "suspend-warehouse",
    "resume-warehouse",
    "resize-warehouse",
    "create-warehouse",
    "drop-warehouse",
    "suspend-compute-pool",
    "resume-compute-pool",
    "run-task",
    "suspend-task",
    "resume-task",
    "suspend-dynamic-table",
    "resume-dynamic-table",
    "execute-procedure",
    "pause-pipe",
    "resume-pipe",
    "create-user",
    "suspend-user",
    "resume-user",
    "grant-privilege",
    "revoke-privilege",
    "suspend-monitor",
    "resume-monitor",
  ])
    expect(snowflakeAdapter.actions.map((a) => a.id)).toContain(id);
  for (const path of [
    "/databases/:database/schemas/:schema/tables/:table",
    "/databases/:database/schemas/:schema/views/:view",
    "/warehouses/:warehouse",
    "/compute-pools",
    "/tasks/:database/:schema/:task",
    "/users/:user",
    "/cost",
    "/logs",
    "/access-history",
    "/account",
  ])
    expect(snowflakeAdapter.pages.map((p) => p.path)).toContain(path);
});

test("database page binds the route param to the schemas resource", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const scope = instance.createPageScope("/databases/ANALYTICS");
  expect(scope.params).toEqual({ database: "ANALYTICS" });
  const table = nodes(scope).find((n) => n.kind === "table");
  expect(table?.kind).toBe("table");
  if (table?.kind === "table") {
    expect(table.props.source?.resourceId).toBe("schemas");
    expect(table.props.source?.input).toEqual({ database: "ANALYTICS" });
    expect(typeof table.props.onRowClick).toBe("function");
  }
  scope.dispose();
  await instance.dispose();
});

test("query history reacts to filter store changes", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const scope = instance.createPageScope("/queries");
  const tableBefore = nodes(scope).find((n) => n.kind === "table");
  if (tableBefore?.kind !== "table") throw new Error("expected table node");
  expect(tableBefore.props.source?.input).toEqual({
    warehouse: null,
    status: null,
    search: "",
  });

  scope.stores.use(queryFiltersStore).setSearch("missing");
  const tableAfter = nodes(scope).find((n) => n.kind === "table");
  if (tableAfter?.kind !== "table") throw new Error("expected table node");
  expect(tableAfter.props.source?.input).toEqual({
    warehouse: null,
    status: null,
    search: "missing",
  });

  const result = await instance.executeResource(
    queries({ warehouse: null, status: null, search: "missing" }),
  );
  expect(result.status).toBe("success");
  scope.dispose();
  await instance.dispose();
});

test("suspend action invalidates the warehouses resource", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const seen: string[] = [];
  const unwatch = instance.watchResource(warehouses(), (result) => {
    if (result.status === "success")
      seen.push(result.data.map((w) => `${w.name}:${w.status}`).join(","));
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const result = await instance.executeAction(
    suspendWarehouse({ warehouse: "ETL_WH" }),
  );
  expect(result.status).toBe("success");
  await new Promise((resolve) => setTimeout(resolve, 10));
  unwatch();
  expect(seen[0]).toContain("ETL_WH:RUNNING");
  expect(seen[seen.length - 1]).toContain("ETL_WH:SUSPENDED");
  await instance.dispose();
});

test("two instances stay isolated", async () => {
  const first = await createAdapterInstance(testAdapter(), CONFIG);
  const second = await createAdapterInstance(testAdapter(), CONFIG);
  first.store(sessionStore).actions.setWarehouse("WH_ONE");
  expect(second.store(sessionStore).get().warehouse).toBeNull();

  await first.executeAction(suspendWarehouse({ warehouse: "ETL_WH" }));
  const other = await second.executeResource(warehouses());
  if (other.status !== "success") throw new Error("expected success");
  expect(other.data.find((w) => w.name === "ETL_WH")?.status).toBe("RUNNING");
  await first.dispose();
  await second.dispose();
});

test("task lifecycle invalidates task resources", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const scope = { database: "ANALYTICS", schema: "PUBLIC" };
  const before = await instance.executeResource(tasks(scope));
  if (before.status !== "success") throw new Error("expected success");
  expect(before.data.find((t) => t.name === "BUILD_MARTS")?.status).toBe(
    "SUSPENDED",
  );

  const resumed = await instance.executeAction(
    resumeTask({ ...scope, task: "BUILD_MARTS" }),
  );
  expect(resumed.status).toBe("success");
  const after = await instance.executeResource(tasks(scope));
  if (after.status !== "success") throw new Error("expected success");
  expect(after.data.find((t) => t.name === "BUILD_MARTS")?.status).toBe(
    "STARTED",
  );

  const ran = await instance.executeAction(
    runTask({ ...scope, task: "LOAD_EVENTS" }),
  );
  expect(ran).toEqual({
    status: "success",
    data: {
      database: "ANALYTICS",
      schema: "PUBLIC",
      task: "LOAD_EVENTS",
      ran: true,
    },
  });
  await instance.dispose();
});

test("cancel query flips status and refreshes history", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const cancelled = await instance.executeAction(
    cancelQuery({ queryId: "q1" }),
  );
  expect(cancelled.status).toBe("success");
  const history = await instance.executeResource(
    queries({ warehouse: null, status: "CANCELLED", search: "" }),
  );
  if (history.status !== "success") throw new Error("expected success");
  expect(history.data.map((q) => q.id)).toContain("q1");
  await instance.dispose();
});

test("run query appends history and stores results", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const result = await instance.executeAction(
    runQuery({
      sql: "SELECT 42",
      warehouse: null,
      database: null,
      schema: null,
      role: null,
    }),
  );
  expect(result.status).toBe("success");
  const history = await instance.executeResource(
    queries({ warehouse: null, status: null, search: "SELECT 42" }),
  );
  if (history.status !== "success") throw new Error("expected success");
  expect(history.data).toHaveLength(1);
  await instance.dispose();
});

test("logs react to search and support polling", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const scope = instance.createPageScope("/logs");
  const table = nodes(scope).find((n) => n.kind === "table");
  if (table?.kind !== "table") throw new Error("expected table node");
  expect(table.props.source?.input).toEqual({ search: "", level: null });

  const seen: number[] = [];
  const unwatch = instance.watchResource(
    logs({ search: "", level: null }),
    (r) => {
      if (r.status === "success") seen.push(r.data.length);
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  unwatch();
  expect(seen.length).toBeGreaterThanOrEqual(1);
  scope.dispose();
  await instance.dispose();
});

test("editor buttons follow editor state", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const scope = instance.createPageScope("/query");
  const kinds = () =>
    nodes(scope)
      .filter((n) => n.kind === "button")
      .map((n) => (n.kind === "button" ? n.props.label : ""));
  // Empty SQL binds nothing: no Run button until there is a query.
  expect(kinds()).toEqual([]);

  scope.stores.use(queryEditorStore).setSql("SELECT 1");
  expect(kinds()).toEqual(["Run"]);

  scope.stores.use(queryEditorStore).setCurrentQueryId("q1");
  expect(kinds()).toEqual(["Run", "Cancel"]);

  scope.stores.use(queryEditorStore).setCurrentQueryId(null);
  expect(kinds()).toEqual(["Run"]);

  scope.stores.use(queryEditorStore).setSql("");
  expect(kinds()).toEqual([]);
  scope.dispose();
  await instance.dispose();
});

test("session bar renders bound selectors", () => {
  const calls: string[] = [];
  const bar = SessionBar({
    role: "ANALYST",
    warehouse: null,
    database: "ANALYTICS",
    schema: null,
    roles: ["ANALYST", "SYSADMIN"],
    warehouses: ["ETL_WH"],
    databases: ["ANALYTICS"],
    onRole: (role) => calls.push(`role:${role}`),
    onWarehouse: (warehouse) => calls.push(`warehouse:${warehouse}`),
    onDatabase: (database) => calls.push(`database:${database}`),
    onSchema: (schema) => calls.push(`schema:${schema}`),
  });
  expect(bar).toHaveLength(4);
  expect(bar[0]).toMatchObject({ kind: "select", props: { name: "role" } });
  const roleSelect = bar[0];
  if (roleSelect.kind !== "select") throw new Error("expected select");
  expect(roleSelect.props.value).toBe("ANALYST");
  expect(roleSelect.props.options).toHaveLength(2);
  roleSelect.props.onChange?.("SYSADMIN");
  expect(calls).toEqual(["role:SYSADMIN"]);
});

test("warehouse detail binds route param with live polling", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const scope = instance.createPageScope("/warehouses/ETL_WH");
  expect(scope.params).toEqual({ warehouse: "ETL_WH" });
  const tabs = nodes(scope).find((n) => n.kind === "tabs");
  expect(tabs?.kind).toBe("tabs");
  if (tabs?.kind !== "tabs") throw new Error("expected tabs");
  const overview = tabs.props.items[0]?.content;
  expect(overview).toMatchObject({ kind: "key-value" });
  if (overview == null || isNodeList(overview) || overview.kind !== "key-value")
    throw new Error("expected key-value");
  expect(overview.props.source?.input).toEqual({ warehouse: "ETL_WH" });
  scope.dispose();
  await instance.dispose();
});

test("create warehouse is form-driven and validated", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const created = await instance.executeAction(
    createWarehouse({ name: "NEW_WH", size: "XSMALL" }),
  );
  expect(created.status).toBe("success");
  const list = await instance.executeResource(warehouses());
  if (list.status !== "success") throw new Error("expected success");
  expect(list.data.map((w) => w.name)).toContain("NEW_WH");
  expect(() => createWarehouse({ name: "", size: "XSMALL" })).toThrow();
  await instance.dispose();
});

test("execute procedure returns a result row", async () => {
  const instance = await createAdapterInstance(testAdapter(), CONFIG);
  const result = await instance.executeAction(
    executeProcedure({
      database: "ANALYTICS",
      schema: "PUBLIC",
      name: "REBUILD_MART",
      args: "",
    }),
  );
  expect(result.status).toBe("success");
  await instance.dispose();
});

test("suspend task validates its input", () => {
  expect(() => suspendTask({ database: "A", schema: "S", task: "" })).toThrow();
});
