import { afterEach, expect, test } from "bun:test";
import { createClickHouseClient, parseResult } from "../src/client";
import { connectionSchema, normalizeConfig } from "../src/config";
import { quoteIdentifier, validateSql } from "../src/sql";

const config = (extra: Record<string, unknown> = {}) =>
  connectionSchema.parse({ method: "structured", host: "localhost", ...extra });
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});
function serve(handler: (request: Request) => Response | Promise<Response>) {
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handler });
  servers.push(server);
  return config({
    host: "127.0.0.1",
    protocol: "http",
    port: server.port,
    compression: false,
  });
}
const result = (data: unknown[][] = [["9007199254740993"]]) =>
  JSON.stringify({ meta: [{ name: "id", type: "UInt64" }], data });

test("connection defaults, URL credentials, IPv6 and proxy paths", () => {
  expect(normalizeConfig(config()).url).toBe("https://localhost:8443");
  expect(normalizeConfig(config({ protocol: "http" })).url).toBe(
    "http://localhost:8123",
  );
  expect(normalizeConfig(config({ host: "::1" })).url).toBe(
    "https://[::1]:8443",
  );
  const parsed = normalizeConfig(
    connectionSchema.parse({
      method: "url",
      url: "https://user:p%40ss@example.com:443/proxy",
    }),
  );
  expect(parsed).toMatchObject({
    url: "https://example.com",
    pathname: "/proxy",
    username: "user",
    password: "p@ss",
  });
});
test("rejects mixed auth, insecure TLS, reserved settings and headers", () => {
  for (const input of [
    { accessToken: "token", password: "password" },
    { clientCert: "cert" },
    { protocol: "http", caCert: "cert" },
    { settingsJson: '{"max_result_rows":0}' },
    { headersJson: '{"Authorization":"secret"}' },
    { headersJson: '{"X-Proxy":"bad\\r\\nvalue"}' },
  ])
    expect(() => normalizeConfig(config(input))).toThrow();
  expect(() =>
    normalizeConfig(
      connectionSchema.parse({
        method: "url",
        url: "https://u:p@host",
        username: "u",
      }),
    ),
  ).toThrow();
  expect(() =>
    normalizeConfig(
      connectionSchema.parse({
        method: "url",
        url: "https://host?password=secret",
      }),
    ),
  ).toThrow();
});
test("single-statement checks ignore strings, comments, identifiers and heredocs", () => {
  for (const sql of [
    "SELECT ';' AS value; -- trailing",
    "/* comment */ SELECT `format` FROM `a;b`",
    "SELECT $tag$hello;world$tag$",
    "SELECT 'it\\'s; fine'",
  ])
    expect(validateSql(sql)).toBe("SELECT");
  for (const sql of [
    "SELECT 1; DROP TABLE x",
    "SELECT 1 FORMAT CSV",
    "SELECT 1 INTO OUTFILE 'file'",
    "-- comment",
    "SELECT 'unterminated",
  ])
    expect(() => validateSql(sql)).toThrow();
  expect(quoteIdentifier("a`b\\c")).toBe("`a\\`b\\\\c`");
});
test("positional results preserve duplicate names and exact values", () => {
  const parsed = parseResult(
    JSON.stringify({
      meta: [
        { name: "id", type: "UInt64" },
        { name: "id", type: "Decimal(20,2)" },
        { name: "id (2)", type: "Nullable(String)" },
      ],
      data: [["9007199254740993", "123456789012345678.90", null]],
    }),
    "query",
    100,
  );
  expect(parsed.columns).toEqual(["id", "id (2)", "id (2) (2)"]);
  expect(parsed.rows[0]).toEqual({
    id: "9007199254740993",
    "id (2)": "123456789012345678.90",
    "id (2) (2)": null,
  });
  expect(() => parseResult(result([[1], [2]]), "id", 1)).toThrow("row limit");
  expect(() =>
    parseResult('{"meta":[],"data":[],"exception":"bad"}', "id", 1),
  ).toThrow("execution error");
});
test("Bun official client sends request-local database, bound params, roles and limits", async () => {
  const received: URL[] = [];
  const cfg = serve(async (request) => {
    received.push(new URL(request.url));
    expect(request.headers.get("authorization")).toBe(
      `Basic ${btoa("alice:password")}`,
    );
    expect(await request.text()).toContain("SELECT");
    return new Response(result(), {
      headers: { "content-type": "application/json" },
    });
  });
  const client = createClickHouseClient({
    ...cfg,
    username: "alice",
    password: "password",
    roles: "analyst",
  });
  try {
    const first = await client.execute("SELECT {id:UInt64}", {
      database: "analytics",
      params: { id: "9007199254740993" },
      maxRows: 5,
    });
    expect(first.rows[0]?.id).toBe("9007199254740993");
    expect(received[0].searchParams.get("database")).toBe("analytics");
    expect(received[0].searchParams.get("param_id")).toBe("9007199254740993");
    expect(received[0].searchParams.get("max_result_rows")).toBe("5");
    await client.execute("SELECT 1");
    expect(received[1].searchParams.get("database")).toBe("default");
  } finally {
    await client.dispose();
  }
});
test("commands can return empty bodies and late HTTP-200 errors fail", async () => {
  let response = "";
  const client = createClickHouseClient(serve(() => new Response(response)));
  try {
    expect(
      (await client.execute("CREATE TABLE x (id UInt8) ENGINE Memory")).rows,
    ).toEqual([]);
    response = "Code: 241. DB::Exception: secret SQL";
    await expect(client.execute("SELECT 1")).rejects.toThrow(
      "incomplete or non-JSON",
    );
  } finally {
    await client.dispose();
  }
});
test("byte bounds reject oversized streams and dispose prevents reuse", async () => {
  const client = createClickHouseClient(
    serve(() => new Response("x".repeat(16 * 1024 * 1024 + 1))),
  );
  try {
    await expect(client.execute("SELECT 1")).rejects.toThrow("16 MiB");
  } finally {
    await client.dispose();
  }
  await expect(client.execute("SELECT 1")).rejects.toThrow("disposed");
});
test("selected database scope rejects other request targets", async () => {
  const cfg = serve(() => new Response(result()));
  const client = createClickHouseClient({ ...cfg, databaseScope: "selected" });
  try {
    await expect(
      client.execute("SELECT 1", { database: "other" }),
    ).rejects.toThrow("scope");
  } finally {
    await client.dispose();
  }
});
test("bearer authentication never sends basic credentials", async () => {
  const cfg = serve((request) => {
    expect(request.headers.get("authorization")).toBe("Bearer token");
    return new Response(result());
  });
  const client = createClickHouseClient({ ...cfg, accessToken: "token" });
  try {
    await client.execute("SELECT 1");
  } finally {
    await client.dispose();
  }
});
