import { describe, expect, test } from "bun:test";
import { createSqlTransport } from "../src/sql-transport.js";

const config = { accountIdentifier: "account", token: "secret-token" };
const limits = { pollIntervalMs: 1, timeoutMs: 1000 };
const pending = () =>
  Response.json({ statementHandle: "handle" }, { status: 202 });
const complete = (data: (string | null)[][] = [["one"]]) => ({
  statementHandle: "handle",
  resultSetMetaData: { numRows: data.length, rowType: [{ name: "VALUE" }] },
  data,
});

function fixture(responses: Response[]) {
  const requests: Request[] = [];
  const fetchFn = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push(new Request(input, init));
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    },
    { preconnect: fetch.preconnect },
  );
  return { requests, fetchFn };
}

describe("Snowflake transport", () => {
  test("polls the same handle after 202 and 429 without resubmitting SQL", async () => {
    const http = fixture([
      pending(),
      Response.json({ statementHandle: "handle" }, { status: 429 }),
      Response.json(complete()),
    ]);
    const transport = createSqlTransport(config, http.fetchFn, limits);
    expect(await transport.statement("SELECT 1")).toEqual({
      columns: ["VALUE"],
      rows: [{ VALUE: "one" }],
    });
    expect(http.requests.map((request) => request.method)).toEqual([
      "POST",
      "GET",
      "GET",
    ]);
    expect(
      http.requests.slice(1).map((request) => new URL(request.url).pathname),
    ).toEqual(["/api/v2/statements/handle", "/api/v2/statements/handle"]);
  });

  test("fails bounded pending work and cancels it remotely", async () => {
    const http = fixture([pending(), pending(), Response.json({})]);
    const transport = createSqlTransport(config, http.fetchFn, {
      ...limits,
      maxPollAttempts: 1,
    });
    await expect(transport.statement("SELECT 1")).rejects.toThrow(
      "polling limit",
    );
    expect(http.requests.at(-1)?.url).toEndWith("/handle/cancel");
    expect(http.requests.at(-1)?.method).toBe("POST");
  });

  test("rejects rows over the configured limit", async () => {
    const http = fixture([Response.json(complete([["one"], ["two"]]))]);
    await expect(
      createSqlTransport(config, http.fetchFn, {
        ...limits,
        maxRows: 1,
      }).statement("SELECT 1"),
    ).rejects.toThrow("row limit");
  });

  test("rejects response bytes over the configured limit", async () => {
    const http = fixture([Response.json(complete())]);
    await expect(
      createSqlTransport(config, http.fetchFn, {
        ...limits,
        maxBytes: 1,
      }).statement("SELECT 1"),
    ).rejects.toThrow("byte limit");
  });

  test("rejects incomplete results instead of hiding missing rows", async () => {
    const body = complete();
    body.resultSetMetaData.numRows = 2;
    const http = fixture([Response.json(body)]);
    await expect(
      createSqlTransport(config, http.fetchFn, limits).statement("SELECT 1"),
    ).rejects.toThrow("Incomplete");
  });

  test("rejects rows whose width differs from metadata", async () => {
    const http = fixture([Response.json(complete([["one", "extra"]]))]);
    await expect(
      createSqlTransport(config, http.fetchFn, limits).statement("SELECT 1"),
    ).rejects.toThrow("row width");
  });

  test("rejects duplicate column names instead of losing values", async () => {
    const body = complete([["one", "two"]]);
    body.resultSetMetaData.rowType.push({ name: "VALUE" });
    const http = fixture([Response.json(body)]);
    await expect(
      createSqlTransport(config, http.fetchFn, limits).statement("SELECT 1"),
    ).rejects.toThrow("Duplicate");
  });

  for (const mode of ["caller cancellation", "disposal"] as const) {
    test(`${mode} aborts active polling and sends remote cancellation`, async () => {
      let notifyPolling = () => {};
      const polling = new Promise<void>((resolve) => {
        notifyPolling = resolve;
      });
      const requests: Request[] = [];
      let activeSignal: AbortSignal | null | undefined;
      const fetchFn = Object.assign(
        async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
          const request = new Request(input, init);
          requests.push(request);
          if (request.url.endsWith("/cancel")) return Response.json({});
          if (request.method === "POST") return pending();
          activeSignal = init?.signal;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            );
            notifyPolling();
          });
        },
        { preconnect: fetch.preconnect },
      );
      const controller = new AbortController();
      const transport = createSqlTransport(config, fetchFn, limits);
      const execution = transport.statement("SELECT 1", [], {
        signal: controller.signal,
      });
      await polling;
      if (mode === "disposal") transport.dispose();
      else controller.abort();
      // Assert after triggering settlement: attaching the rejects assertion
      // before the abort hangs under Bun's test runner.
      await expect(execution).rejects.toThrow("aborted");
      expect(activeSignal?.aborted).toBe(true);
      expect(requests.at(-1)?.url).toEndWith("/handle/cancel");
      expect(requests.at(-1)?.signal.aborted).toBe(false);
    });
  }

  test("ignores provider status URLs and disallows redirects", async () => {
    const http = fixture([
      Response.json(
        {
          statementHandle: "handle",
          statementStatusUrl: "https://attacker.invalid/steal",
        },
        { status: 202 },
      ),
      Response.json(complete()),
    ]);
    await createSqlTransport(config, http.fetchFn, limits).statement(
      "SELECT 1",
    );
    for (const request of http.requests) {
      expect(new URL(request.url).origin).toBe(
        "https://account.snowflakecomputing.com",
      );
      expect(request.redirect).toBe("error");
    }
  });

  test("does not expose provider HTTP error bodies", async () => {
    const http = fixture([
      Response.json({ message: config.token }, { status: 403 }),
    ]);
    await expect(
      createSqlTransport(config, http.fetchFn, limits).statement("SELECT 1"),
    ).rejects.toThrow("Snowflake request failed (HTTP 403)");
  });

  test("does not expose secrets in network exceptions", async () => {
    const fetchFn = Object.assign(
      async () => {
        throw new Error(`Cannot connect using ${config.token}`);
      },
      { preconnect: fetch.preconnect },
    );
    try {
      await createSqlTransport(config, fetchFn, limits).statement("SELECT 1");
      throw new Error("Expected request failure");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(config.token);
    }
  });
});
