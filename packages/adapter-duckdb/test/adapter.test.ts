import { expect, test } from "bun:test";
import {
  createAdapterInstance,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "../src/actions/run-query.js";
import duckdbAdapter from "../src/adapter.js";
import { lockConflictMessage } from "../src/duckdb-client.js";
import {
  databaseCards,
  databaseSize,
  databaseStats,
  databases,
  extensionCards,
  overview,
  recentQueries,
  recentTables,
  relations,
  storageMeter,
  tablePreview,
  tableRowCounts,
  tables,
  version,
  viewDdl,
} from "../src/resources/catalog.js";
import {
  activityFiltersStore,
  dataExplorerStore,
  fileBrowserStore,
  sessionStore,
} from "../src/stores/index.js";

const MEMORY = { method: "memory" };

test.each([
  ["omitted", {}],
  ["explicit false", { readOnly: false }],
  ["string false", { readOnly: "false" }],
  ["string true", { readOnly: "true" }],
  ["placeholder empty string", { readOnly: "" }],
])("accepts readOnly as %s", async (_label, extra) => {
  const instance = await createAdapterInstance(duckdbAdapter, {
    method: "memory",
    ...extra,
  });
  expect(instance).toBeTruthy();
  await instance.dispose();
});

test("translates file-lock failures into concurrency guidance", () => {
  const locked = new Error(
    'IO Error: Could not set lock on file "/tmp/demo.duckdb": Conflicting lock is held',
  );
  expect(lockConflictMessage(locked)).toMatch(
    /locked by another process.*https:\/\/duckdb\.org\/docs\/stable\/connect\/concurrency/,
  );
  expect(lockConflictMessage(new Error("boom"))).toBeNull();
  expect(lockConflictMessage("plain string")).toBeNull();
});

test("runs ad-hoc SQL against a real in-memory instance", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const result = await instance.executeAction(
    runQuery({ sql: "SELECT 1 AS n, 'x' AS s" }),
  );
  expect(result.status).toBe("success");
  if (result.status === "success") {
    expect(result.data).toMatchObject({
      columns: ["n", "s"],
      columnTypes: ["INTEGER", "VARCHAR"],
      rows: [{ n: 1, s: "x" }],
      elapsedMs: expect.any(Number),
    });
  }
  await instance.dispose();
});

test("returns large ad-hoc results without a row cap", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const result = await instance.executeAction(
    runQuery({ sql: "SELECT i FROM range(15000) t(i)" }),
  );
  expect(result.status).toBe("success");
  if (result.status === "success") {
    expect(result.data.rows).toHaveLength(15000);
  }
  await instance.dispose();
});

test("lists databases and tables from the live catalog", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(runQuery({ sql: "CREATE TABLE t(i INTEGER)" }));

  const dbs = await instance.executeResource(databases());
  expect(dbs.status).toBe("success");
  if (dbs.status === "success") {
    expect(dbs.data.map((database) => database.name)).not.toContain("system");
    expect(dbs.data.map((database) => database.name)).not.toContain("temp");
  }

  const tbls = await instance.executeResource(
    tables({ database: "memory", schema: "main" }),
  );
  expect(tbls.status).toBe("success");
  if (tbls.status === "success") {
    expect(tbls.data).toContainEqual(
      expect.objectContaining({ name: "t", type: "BASE TABLE" }),
    );
  }
  await instance.dispose();
});

test("successful worksheet DDL refreshes watched explorer relations", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  let resolveRefresh: (() => void) | undefined;
  let rejectRefresh: ((error: Error) => void) | undefined;
  const refreshed = new Promise<void>((resolve, reject) => {
    resolveRefresh = resolve;
    rejectRefresh = reject;
  });
  const timeout = setTimeout(
    () => rejectRefresh?.(new Error("explorer did not refresh")),
    500,
  );
  const unwatch = instance.watchResource(
    relations({ database: "memory", schema: "main", type: "all" }),
    (result) => {
      if (
        result.status === "success" &&
        result.data.some((relation) => relation.name === "explorer_refresh")
      )
        clearTimeout(timeout);
      resolveRefresh?.();
    },
  );

  await instance.executeAction(
    runQuery({ sql: "CREATE TABLE explorer_refresh(id INTEGER)" }),
  );
  await refreshed;
  unwatch();
  await instance.dispose();
});

test("previews table rows with JSON-safe values", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(
    runQuery({ sql: "CREATE TABLE p(id BIGINT, name VARCHAR)" }),
  );
  await instance.executeAction(
    runQuery({ sql: "INSERT INTO p VALUES (42, 'a'), (43, 'b')" }),
  );
  const preview = await instance.executeResource(
    tablePreview({ database: "memory", schema: "main", table: "p", limit: 10 }),
  );
  expect(preview.status).toBe("success");
  if (preview.status === "success") {
    expect(preview.data).toEqual([
      { id: "42", name: "a" },
      { id: "43", name: "b" },
    ]);
  }
  await instance.dispose();
});

test("combines tables and views into a typed relation list", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(
    runQuery({ sql: "CREATE TABLE orders(id INTEGER)" }),
  );
  await instance.executeAction(
    runQuery({ sql: "CREATE VIEW order_ids AS SELECT id FROM orders" }),
  );

  const result = await instance.executeResource(
    relations({ database: "memory", schema: "main", type: "all" }),
  );
  expect(result).toMatchObject({
    status: "success",
    data: [
      { name: "order_ids", type: "VIEW", relationType: "views" },
      { name: "orders", type: "TABLE", relationType: "tables" },
    ],
  });

  await instance.dispose();
});

test("returns view DDL in a renderer-friendly detail record", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(
    runQuery({ sql: "CREATE VIEW answer AS SELECT 42 AS n" }),
  );

  const result = await instance.executeResource(
    viewDdl({ database: "memory", schema: "main", view: "answer" }),
  );
  expect(result).toMatchObject({
    status: "success",
    data: { sql: expect.stringContaining("CREATE VIEW") },
  });

  await instance.dispose();
});

test("the overview page renders a compact workspace summary", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const scope = instance.createPageScope("/");
  const nodes = scope.render();
  const list = Array.isArray(nodes) ? nodes : [nodes];

  expect(list.map((node) => node.kind)).toEqual([
    "page-header",
    "stat-grid",
    "columns",
    "columns",
    "columns",
  ]);

  scope.dispose();
  await instance.dispose();
});

test("returns overview details as key-value records rather than query wrappers", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const engine = await instance.executeResource(version());
  const storage = await instance.executeResource(databaseSize({}));
  const summary = await instance.executeResource(overview());

  expect(engine).toMatchObject({
    status: "success",
    data: { version: expect.any(String) },
  });
  expect(storage).toMatchObject({
    status: "success",
    data: { name: "memory", database_size: expect.any(String) },
  });
  expect(summary).toMatchObject({
    status: "success",
    data: {
      threads: expect.any(Number),
      totalSizeBytes: expect.any(Number),
      totalSize: expect.any(String),
    },
  });

  await instance.dispose();
});

test("reports per-database stats, exact row counts, and storage", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(
    runQuery({ sql: "CREATE TABLE stats_t(id INTEGER)" }),
  );
  await instance.executeAction(
    runQuery({ sql: "INSERT INTO stats_t VALUES (1), (2), (3)" }),
  );

  const stats = await instance.executeResource(databaseStats());
  expect(stats.status).toBe("success");
  if (stats.status === "success") {
    expect(stats.data).toContainEqual(
      expect.objectContaining({ database: "memory", tables: 1 }),
    );
  }

  const counts = await instance.executeResource(
    tableRowCounts({ database: "memory", schema: "main", table: "stats_t" }),
  );
  expect(counts).toMatchObject({
    status: "success",
    data: { database: "memory", schema: "main", name: "stats_t", rows: 3 },
  });

  // A write through run-query invalidates cached counts.
  await instance.executeAction(
    runQuery({ sql: "INSERT INTO stats_t VALUES (4)" }),
  );
  const recounted = await instance.executeResource(
    tableRowCounts({ database: "memory", schema: "main", table: "stats_t" }),
  );
  expect(recounted).toMatchObject({ status: "success", data: { rows: 4 } });

  const storage = await instance.executeResource(storageMeter({}));
  expect(storage.status).toBe("success");
  if (storage.status === "success") {
    expect(storage.data.segments).toEqual([
      expect.objectContaining({ label: "Table data" }),
      expect.objectContaining({ label: "Indexes, metadata & free pages" }),
    ]);
    expect("footer" in storage.data).toBe(false);
  }

  await instance.dispose();
});

test("lists recent tables ordered by row count with a limit", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(
    runQuery({ sql: "CREATE TABLE rt_small(i INTEGER)" }),
  );
  await instance.executeAction(
    runQuery({ sql: "INSERT INTO rt_small VALUES (1)" }),
  );
  await instance.executeAction(
    runQuery({ sql: "CREATE TABLE rt_big(i INTEGER)" }),
  );
  await instance.executeAction(
    runQuery({ sql: "INSERT INTO rt_big VALUES (1), (2), (3)" }),
  );

  const all = await instance.executeResource(recentTables({ limit: 5 }));
  expect(all.status).toBe("success");
  if (all.status === "success") {
    const names = all.data.map((row) => row.name);
    expect(names.indexOf("rt_big")).toBeLessThan(names.indexOf("rt_small"));
    expect(all.data.find((row) => row.name === "rt_big")).toMatchObject({
      rows: 3,
    });
  }

  const limited = await instance.executeResource(recentTables({ limit: 1 }));
  expect(limited.status).toBe("success");
  if (limited.status === "success") {
    expect(limited.data).toHaveLength(1);
    expect(limited.data[0]?.name).toBe("rt_big");
  }

  await instance.dispose();
});

test("shapes database and extension cards with links", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(runQuery({ sql: "CREATE TABLE c(id INTEGER)" }));

  const cards = await instance.executeResource(databaseCards());
  expect(cards.status).toBe("success");
  if (cards.status === "success") {
    expect(cards.data).toContainEqual(
      expect.objectContaining({
        name: "memory",
        title: "memory",
        badge: "Primary",
        link: { path: "/data/:database", params: { database: "name" } },
      }),
    );
    const memory = cards.data.find((row) => row.name === "memory");
    expect(memory?.meta).toHaveLength(3);
    expect(memory?.meta?.[0]).toMatch(/schemas?$/);
    expect(memory?.meta?.[1]).toMatch(/tables?$/);
    expect(memory?.meta?.[2]).toMatch(/views?$/);
  }

  const extensions = await instance.executeResource(extensionCards());
  expect(extensions.status).toBe("success");
  if (extensions.status === "success") {
    for (const row of extensions.data) {
      expect(row).toMatchObject({
        name: expect.any(String),
        title: expect.any(String),
        badge: expect.any(String),
      });
    }
  }

  await instance.dispose();
});

test("lists recent successful queries with age and duration", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  await instance.executeAction(runQuery({ sql: "SELECT 1" }));
  await instance.executeAction(runQuery({ sql: "SELECT nope((" }));

  const recent = await instance.executeResource(recentQueries({ limit: 5 }));
  expect(recent.status).toBe("success");
  if (recent.status === "success") {
    expect(recent.data).toHaveLength(1);
    expect(recent.data[0]).toMatchObject({
      query: "SELECT 1",
      age: expect.any(String),
      duration: expect.stringMatching(/ms$/),
    });
  }

  await instance.dispose();
});

test("the query page exposes a serializable query editor", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const scope = instance.createPageScope("/query");
  const nodes = scope.render();
  const list = Array.isArray(nodes) ? nodes : [nodes];

  expect(list.map((node) => node.kind)).toEqual([
    "page-header",
    "query-editor",
  ]);

  scope.dispose();
  await instance.dispose();
});

test.each([
  "/",
  "/data",
  "/data/memory/main/tables/orders",
  "/data/memory/main/views/order_view",
  "/query",
  "/files",
  "/extensions",
  "/extensions/httpfs",
  "/activity",
])("serializes the exposed %s page for the browser", async (path) => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const scope = instance.createPageScope(path);

  expect(() => serializeNodes(scope.render())).not.toThrow();

  scope.dispose();
  await instance.dispose();
});

test("exposes the DuckDB workspace navigation and nested data routes", () => {
  expect(duckdbAdapter.pages.map((page) => page.path)).toEqual([
    "/",
    "/data",
    "/data/:database",
    "/data/:database/:schema",
    "/data/:database/:schema/:relationType/:relation",
    "/query",
    "/files",
    "/extensions",
    "/extensions/:extension",
    "/activity",
  ]);
});

test("the Data page presents a persistent database explorer", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const scope = instance.createPageScope("/data");
  const nodes = scope.render();
  const list = Array.isArray(nodes) ? nodes : [nodes];

  expect(list.map((node) => node.kind)).toEqual(["split-pane"]);
  expect(list[0]).toMatchObject({
    kind: "split-pane",
    props: {
      sidebar: {
        kind: "resource-tree",
        props: {
          selectedPath: "/data",
          branch: {
            children: { children: { typeField: "type" } },
          },
        },
      },
    },
  });

  scope.dispose();
  await instance.dispose();
});

test("schema pages keep tables and views in one Objects list", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const scope = instance.createPageScope("/data/memory/main");
  const nodes = scope.render();
  const list = Array.isArray(nodes) ? nodes : [nodes];
  const pane = list[0];

  expect(pane).toMatchObject({
    kind: "split-pane",
    props: {
      sidebar: { kind: "resource-tree" },
      content: [
        { kind: "page-header", props: { title: "main" } },
        {
          kind: "tabs",
          props: { items: [{ label: "Objects" }, { label: "Overview" }] },
        },
      ],
    },
  });

  scope.dispose();
  await instance.dispose();
});

test("table detail prioritizes overview, data, columns, statistics, and DDL", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const scope = instance.createPageScope("/data/memory/main/tables/orders");
  const nodes = scope.render();
  const list = Array.isArray(nodes) ? nodes : [nodes];

  expect(list[0]).toMatchObject({
    kind: "split-pane",
    props: {
      sidebar: {
        kind: "resource-tree",
        props: { selectedPath: "/data/memory/main/tables/orders" },
      },
      content: [
        {
          kind: "page-header",
          props: {
            title: "orders",
            description: "memory / main / orders · TABLE",
          },
        },
        {
          kind: "tabs",
          props: {
            items: [
              { label: "Preview" },
              { label: "Schema" },
              { label: "Details" },
              { label: "Statistics" },
              { label: "DDL" },
            ],
          },
        },
      ],
    },
  });

  scope.dispose();
  await instance.dispose();
});

test("DuckDB UI stores contain only local selection and filter state", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, MEMORY);
  const session = instance.store(sessionStore);
  expect(session.get()).toEqual({ database: null, schema: null });
  session.actions.setDatabase("analytics");
  session.actions.setSchema("marts");
  expect(session.get()).toEqual({ database: "analytics", schema: "marts" });
  session.actions.resetContext();
  expect(session.get()).toEqual({ database: null, schema: null });

  expect(dataExplorerStore.initialState).toEqual({
    search: "",
    objectType: "all",
  });
  expect(fileBrowserStore.initialState).toEqual({ search: "", type: null });
  expect(activityFiltersStore.initialState).toEqual({
    search: "",
    status: null,
  });

  await instance.dispose();
});

test("measures table allocation against a real file database", async () => {
  const { stat, unlink } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const path = join(tmpdir(), `dsui-table-bytes-${Date.now()}.duckdb`);
  const instance = await createAdapterInstance(duckdbAdapter, {
    method: "file",
    path,
  });
  try {
    await instance.executeAction(
      runQuery({ sql: "CREATE TABLE big(id INTEGER, name VARCHAR)" }),
    );
    await instance.executeAction(
      runQuery({
        sql: "INSERT INTO big SELECT i, 'name-' || i FROM range(5000) t(i)",
      }),
    );
    await instance.executeAction(runQuery({ sql: "CHECKPOINT" }));
    const metered = await instance.executeResource(storageMeter({}));
    expect(metered.status).toBe("success");
    if (metered.status === "success") {
      const table = metered.data.segments[0]?.value ?? 0;
      const fileBytes = (await stat(path)).size;
      expect(table).toBeGreaterThan(0);
      expect(table).toBeLessThanOrEqual(fileBytes);
    }
  } finally {
    await instance.dispose();
    await unlink(path).catch(() => undefined);
  }
});
