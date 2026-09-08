import { expect, spyOn, test } from "bun:test";
import { createAdapterInstance } from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "../src/actions/run-query.js";
import { snowflakeAdapter } from "../src/adapter.js";
import { databases } from "../src/resources/databases.js";

test("default adapter reads Snowflake rather than fixture data", async () => {
  const http = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      resultSetMetaData: { rowType: [{ name: "name" }], numRows: 1 },
      data: [["REAL_DATABASE"]],
    }),
  );
  const instance = await createAdapterInstance(snowflakeAdapter, {
    accountIdentifier: "test-account",
    token: "fixture-token",
  });
  try {
    expect(await instance.executeResource(databases())).toEqual({
      status: "success",
      data: ["REAL_DATABASE"],
    });
    expect(http).toHaveBeenCalledTimes(1);
  } finally {
    await instance.dispose();
    http.mockRestore();
  }
});

test("query action passes the selected role and abort signal to the client", async () => {
  const http = spyOn(globalThis, "fetch").mockImplementation((async (
    _input,
    init,
  ) => {
    const body = JSON.parse(String(init?.body));
    expect(body.role).toBe("SELECTED_ROLE");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return Response.json({
      resultSetMetaData: { rowType: [], numRows: 0 },
      data: [],
    });
  }) as typeof fetch);
  const instance = await createAdapterInstance(snowflakeAdapter, {
    accountIdentifier: "test-account",
    token: "fixture-token",
    role: "DEFAULT_ROLE",
  });
  try {
    const result = await instance.executeAction(
      runQuery({
        sql: "SELECT 1",
        warehouse: null,
        database: null,
        schema: null,
        role: "SELECTED_ROLE",
      }),
      { signal: new AbortController().signal },
    );
    expect(result.status).toBe("success");
    expect(http).toHaveBeenCalledTimes(1);
  } finally {
    await instance.dispose();
    http.mockRestore();
  }
});
