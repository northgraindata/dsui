import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDuckDbClient, lockConflictMessage } from "./duckdb-client.js";

describe("DuckDB client", () => {
  const clients: ReturnType<typeof createDuckDbClient>[] = [];

  beforeEach(() => {
    clients.push(createDuckDbClient({ method: "memory" }));
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.dispose();
  });

  test("executes SQL, returns columns and types, and reports the version", async () => {
    const client = clients[0];
    const result = await client.execute(
      "SELECT 42 AS answer, 'value' AS text_value, [1, 2] AS values",
    );

    expect(result.columns).toEqual(["answer", "text_value", "values"]);
    expect(result.columnTypes).toEqual(["INTEGER", "VARCHAR", "INTEGER[]"]);
    expect(result.rows).toEqual([
      { answer: 42, text_value: "value", values: [1, 2] },
    ]);
    expect(await client.version()).toMatch(/^v?\d+\.\d+\.\d+/);
  });

  test("supports catalog discovery, DDL, previews, summaries, and counts", async () => {
    const client = clients[0];
    await client.execute(`
      CREATE SCHEMA analytics;
      CREATE TABLE analytics.events (id INTEGER, name VARCHAR, amount DECIMAL(10, 2));
      INSERT INTO analytics.events VALUES (1, 'one', 10.50), (2, 'two', 20.25);
      CREATE VIEW analytics.event_view AS SELECT id, name FROM analytics.events;
      CREATE SEQUENCE analytics.event_sequence;
      CREATE INDEX event_name_index ON analytics.events(name);
      CREATE MACRO analytics.add_one(value) AS value + 1;
    `);

    const databases = await client.listDatabases();
    expect(databases.map(({ name }) => name)).toContain("memory");
    expect(await client.getDatabase("missing")).toBeNull();
    expect(await client.getDatabase("memory")).toMatchObject({
      name: "memory",
      internal: false,
      readonly: false,
    });

    expect(
      (await client.listSchemas("memory")).map(({ name }) => name),
    ).toContain("analytics");
    expect(await client.listTables("memory", "analytics")).toEqual([
      {
        database: "memory",
        schema: "analytics",
        name: "events",
        type: "BASE TABLE",
      },
    ]);
    expect(await client.listViews("memory", "analytics")).toEqual([
      { database: "memory", schema: "analytics", name: "event_view" },
    ]);
    expect(await client.listSequences("memory", "analytics")).toEqual([
      { database: "memory", schema: "analytics", name: "event_sequence" },
    ]);
    expect(await client.listIndexes("memory", "analytics")).toEqual([
      expect.objectContaining({
        database: "memory",
        schema: "analytics",
        name: "event_name_index",
        table: "events",
      }),
    ]);
    expect(await client.listMacros("memory", "analytics")).toEqual([
      expect.objectContaining({
        database: "memory",
        schema: "analytics",
        name: "add_one",
      }),
    ]);
    expect(await client.getColumns("memory", "analytics", "events")).toEqual([
      { name: "id", type: "INTEGER", nullable: true },
      { name: "name", type: "VARCHAR", nullable: true },
      { name: "amount", type: "DECIMAL(10,2)", nullable: true },
    ]);
    expect(await client.countRows("memory", "analytics", "events")).toBe(2);
    expect(
      (await client.previewTable("memory", "analytics", "events", 1)).rows,
    ).toHaveLength(1);
    expect(
      (await client.previewTable("memory", "analytics", "events", 0)).rows,
    ).toHaveLength(1);
    expect(await client.getTableDdl("memory", "analytics", "events")).toContain(
      "CREATE TABLE",
    );
    expect(
      await client.getViewDdl("memory", "analytics", "event_view"),
    ).toContain("CREATE VIEW");
    const summary = await client.summarizeTable(
      "memory",
      "analytics",
      "events",
    );
    expect(summary.columns).toContain("count");
    expect(summary.rows).toHaveLength(3);
  });

  test("caches row counts and invalidates the cache after execution", async () => {
    const client = clients[0];
    await client.execute("CREATE TABLE items (id INTEGER)");
    await client.execute("INSERT INTO items VALUES (1)");
    expect(await client.countRows("memory", "main", "items")).toBe(1);
    await client.execute("INSERT INTO items VALUES (2)");
    expect(await client.countRows("memory", "main", "items")).toBe(2);
  });

  test("lists overview, database statistics, storage, functions, and types", async () => {
    const client = clients[0];
    await client.execute("CREATE TABLE items (id INTEGER)");

    const overview = await client.getOverview();
    expect(overview).toMatchObject({
      databases: 1,
      schemas: 1,
      tables: 1,
      views: 0,
    });
    expect(overview.totalSize).toMatch(/^(0 B|[\d.]+ [KMGT]B)$/);
    expect(await client.databaseStats()).toEqual([
      { database: "memory", schemas: 1, tables: 1, views: 0 },
    ]);
    expect(await client.storageSummary()).toMatchObject({
      database: "memory",
      path: null,
      free: "—",
    });
    expect(await client.tableDataBytes()).toBeGreaterThanOrEqual(0);
    expect(await client.databaseSize("memory")).toMatchObject({
      columns: ["name", "database_size"],
    });
    expect((await client.listFunctions("date")).length).toBeGreaterThan(0);
    expect((await client.listFunctions()).length).toBeGreaterThan(0);
    expect(
      (await client.listTypes()).some(({ name }) => name === "INTEGER"),
    ).toBe(true);
  });

  test("lists extensions and rejects invalid restart requests", async () => {
    const client = clients[0];
    const extensions = await client.listExtensions();
    expect(extensions.length).toBeGreaterThan(0);
    expect(extensions.some(({ name }) => name === "json")).toBe(true);
    await expect(client.restartExtension("missing", "reload")).rejects.toThrow(
      "Extension not found",
    );
    const builtIn = extensions.find(
      ({ installationMode }) => installationMode === "STATICALLY_LINKED",
    );
    if (builtIn)
      await expect(
        client.restartExtension(builtIn.name, "unload"),
      ).rejects.toThrow("built-in extension");
  });

  test("manages settings and secrets", async () => {
    const client = clients[0];
    expect(
      (await client.listSettings("threads")).some(
        ({ name }) => name === "threads",
      ),
    ).toBe(true);
    await client.setSetting("threads", "1");
    expect(
      (await client.listSettings("threads")).find(
        ({ name }) => name === "threads",
      )?.value,
    ).toBe("1");
    await client.resetSetting("threads");

    await client.createSecret({
      type: "S3",
      keyId: "key",
      secret: "secret",
      region: "eu-west-1",
      endpoint: "localhost:9000",
      scope: "s3://bucket/*",
    });
    expect(await client.listSecrets()).toEqual([
      expect.objectContaining({ name: "__default_s3", type: "s3" }),
    ]);
    await client.dropSecret("__default_s3");
    expect(await client.listSecrets()).toEqual([]);
    await expect(client.dropSecret("missing")).rejects.toThrow(
      "DROP SECRET failed",
    );
  });

  test("attaches and detaches databases and preserves identifier quoting", async () => {
    const client = clients[0];
    const path = join(tmpdir(), `dsui-attached-${crypto.randomUUID()}.duckdb`);
    try {
      await client.execute(
        'CREATE TABLE "quoted table" ("quoted column" VARCHAR)',
      );
      await client.attach({ source: path, alias: "attached database" });
      expect(await client.getDatabase("attached database")).toMatchObject({
        name: "attached database",
      });
      await client.detach("attached database");
      expect(await client.getDatabase("attached database")).toBeNull();
    } finally {
      client.dispose();
      await rm(path, { force: true });
    }
  });

  test("rejects aborted queries and unsafe remote connection targets", async () => {
    const client = clients[0];
    const controller = new AbortController();
    controller.abort();
    await expect(
      client.execute("SELECT 1", { signal: controller.signal }),
    ).rejects.toThrow("Query aborted");

    const invalid = createDuckDbClient({
      method: "s3",
      url: "https://127.0.0.1/data.parquet",
    });
    try {
      await expect(invalid.version()).rejects.toThrow("private network");
    } finally {
      invalid.dispose();
    }
    const credentials = createDuckDbClient({
      method: "s3",
      url: "https://user:password@example.com/data.parquet",
    });
    try {
      await expect(credentials.version()).rejects.toThrow(
        "embedded credentials",
      );
    } finally {
      credentials.dispose();
    }
  });
});

test("translates DuckDB lock errors and ignores unrelated errors", () => {
  expect(
    lockConflictMessage(new Error("Could not set lock on file test.duckdb")),
  ).toContain("Database file is locked");
  expect(lockConflictMessage(new Error("parser error"))).toBeNull();
  expect(lockConflictMessage("conflicting lock is held")).toContain(
    "close the other connection",
  );
});
