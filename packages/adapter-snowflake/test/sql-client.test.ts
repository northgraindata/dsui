import { describe, expect, test } from "bun:test";
import { createSnowflakeClient } from "../src/sql-client.js";

const config = { accountIdentifier: "test-account", token: "test-token" };
const options = { warehouse: null, database: null, schema: null, role: null };

function httpFixture(responses: Response[]) {
  const requests: Request[] = [];
  const fetchFn = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push(new Request(input, init));
      const response = responses.shift();
      if (!response) throw new Error("Unexpected HTTP request");
      return response;
    },
    { preconnect: fetch.preconnect },
  );
  return { fetchFn, requests };
}

function result(columns: string[], data: unknown[][]) {
  return {
    statementHandle: "statement-1",
    resultSetMetaData: {
      numRows: data.length,
      rowType: columns.map((name) => ({ name, type: "text" })),
    },
    data,
  };
}

function emptyResult() {
  return Response.json(result([], []));
}

describe("Snowflake SQL API client", () => {
  for (const operation of [
    "databases",
    "schemas",
    "tables",
    "views",
  ] as const) {
    test(`lists ${operation} from the name column, not created_on`, async () => {
      const http = httpFixture([
        Response.json(
          result(["created_on", "name"], [["2026-01-01", "ANALYTICS"]]),
        ),
      ]);
      const client = createSnowflakeClient(config, http.fetchFn);
      const names =
        operation === "databases"
          ? await client.listDatabases()
          : operation === "schemas"
            ? await client.listSchemas("DB")
            : operation === "tables"
              ? await client.listTables("DB", "PUBLIC")
              : await client.listViews("DB", "PUBLIC");
      expect(names).toEqual(["ANALYTICS"]);
    });
  }

  test("uses the selected execution context instead of configured defaults", async () => {
    const http = httpFixture([emptyResult()]);
    const client = createSnowflakeClient(
      {
        ...config,
        warehouse: "DEFAULT_WH",
        database: "DEFAULT_DB",
        schema: "DEFAULT_SCHEMA",
        role: "DEFAULT_ROLE",
      },
      http.fetchFn,
    );
    const selected = {
      warehouse: "SELECTED_WH",
      database: "SELECTED_DB",
      schema: "SELECTED_SCHEMA",
      role: "SELECTED_ROLE",
    };
    await client.execute("SELECT 1", selected);
    expect(await http.requests[0]?.json()).toMatchObject(selected);
  });

  test("rejects a malformed successful response instead of returning empty success", async () => {
    const http = httpFixture([Response.json({ unexpected: "payload" })]);
    const client = createSnowflakeClient(config, http.fetchFn);
    await expect(client.execute("SELECT 1", options)).rejects.toThrow();
  });

  test("retrieves all result partitions", async () => {
    const first = result(["VALUE"], [["first"]]);
    const http = httpFixture([
      Response.json({
        ...first,
        resultSetMetaData: {
          ...first.resultSetMetaData,
          numRows: 2,
          partitionInfo: [
            { rowCount: 1, uncompressedSize: 10 },
            { rowCount: 1, uncompressedSize: 10 },
          ],
        },
      }),
      Response.json({ data: [["second"]] }),
    ]);
    const client = createSnowflakeClient(config, http.fetchFn);
    expect(await client.execute("SELECT VALUE FROM ITEMS", options)).toEqual({
      columns: ["VALUE"],
      rows: [{ VALUE: "first" }, { VALUE: "second" }],
    });
    expect(
      new URL(
        http.requests[1]?.url ?? "https://missing.invalid",
      ).searchParams.get("partition"),
    ).toBe("1");
  });

  test("binds database names containing SQL syntax as values", async () => {
    const http = httpFixture([emptyResult()]);
    const client = createSnowflakeClient(config, http.fetchFn);
    const database = "O'HARE'; DROP DATABASE OTHER; --";
    await client.getDatabase(database);
    const body = await http.requests[0]?.json();
    expect(body.statement).not.toContain(database);
    expect(Object.values(body.bindings ?? {})).toContainEqual({
      type: "TEXT",
      value: database,
    });
  });

  test("rejects privilege fragment injection before contacting Snowflake", async () => {
    const http = httpFixture([emptyResult()]);
    const client = createSnowflakeClient(config, http.fetchFn);
    await expect(
      client.grantPrivilege({
        privilege: "SELECT; DROP DATABASE OTHER; --",
        objectType: "TABLE",
        objectName: "DB.PUBLIC.ITEMS",
        to: "ANALYST",
      }),
    ).rejects.toThrow();
    expect(http.requests).toHaveLength(0);
  });

  test("propagates query result authorization failures", async () => {
    const http = httpFixture([
      Response.json({ message: "Access denied" }, { status: 403 }),
    ]);
    const client = createSnowflakeClient(config, http.fetchFn);
    await expect(client.getQueryResults("query-1")).rejects.toThrow();
  });
});
