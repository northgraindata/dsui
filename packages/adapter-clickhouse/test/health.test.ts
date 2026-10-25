import { expect, test } from "bun:test";
import type { ClickHouseContext } from "../src/context";
import { clickhouseHealth } from "../src/health";

type Row = Record<string, unknown>;

function context(options: {
  replicas?: Row | Error;
  parts?: Row | Error;
  disk?: Row | Error;
  unreachable?: boolean;
  slow?: boolean;
}): ClickHouseContext {
  const respond = (value: Row | Error | undefined) => {
    if (value instanceof Error) throw value;
    return {
      columns: [],
      columnTypes: [],
      rows: value ? [value] : [],
      rowCount: value ? 1 : 0,
      queryId: "q",
    };
  };
  return {
    client: {
      execute: async (sql: string) => {
        if (sql.includes("reachable")) {
          if (options.unreachable) throw new Error("ECONNREFUSED");
          if (options.slow) await new Promise((r) => setTimeout(r, 1100));
          return respond({ reachable: 1 });
        }
        if (sql.includes("system.replicas")) return respond(options.replicas);
        if (sql.includes("asynchronous_metrics")) return respond(options.parts);
        return respond(options.disk);
      },
    },
  } as unknown as ClickHouseContext;
}

const ids = (report: Awaited<ReturnType<typeof clickhouseHealth>>) =>
  report.checks.map((check) => check.id);

test("a healthy single node reports only what it has", async () => {
  const report = await clickhouseHealth(
    context({
      replicas: { total: "0", readonly: "0", max_delay: "0" },
      parts: { value: 12 },
      disk: { free: 0.62 },
    }),
  );
  expect(report.status).toBe("healthy");
  expect(report.score).toBe(100);
  expect(ids(report)).toEqual([
    "authenticated-query",
    "response-time",
    "parts",
    "disk",
  ]);
});

test("64-bit integers returned as strings are understood", async () => {
  const report = await clickhouseHealth(
    context({ replicas: { total: "2", readonly: "1", max_delay: "0" } }),
  );
  const check = report.checks.find((c) => c.id === "replicas");
  expect(check).toMatchObject({
    ok: false,
    detail: "1 of 2 replicas read-only",
  });
  expect(report.status).toBe("warning");
});

test("a replica far behind is reported", async () => {
  const report = await clickhouseHealth(
    context({ replicas: { total: "3", readonly: "0", max_delay: "900" } }),
  );
  expect(report.checks.find((c) => c.id === "replicas")?.ok).toBe(false);
});

test("too many parts and a nearly full disk degrade the service", async () => {
  const report = await clickhouseHealth(
    context({ parts: { value: 800 }, disk: { free: 0.04 } }),
  );
  expect(report.checks.find((c) => c.id === "parts")?.ok).toBe(false);
  expect(report.checks.find((c) => c.id === "disk")).toMatchObject({
    ok: false,
    detail: "4% free on the fullest disk",
  });
  expect(report.status).toBe("warning");
  expect(report.score).toBe(50);
});

test("views the role cannot read are left out, not failed", async () => {
  const report = await clickhouseHealth(
    context({
      replicas: new Error("ACCESS_DENIED"),
      parts: new Error("ACCESS_DENIED"),
      disk: new Error("ACCESS_DENIED"),
    }),
  );
  expect(report.status).toBe("healthy");
  expect(ids(report)).toEqual(["authenticated-query", "response-time"]);
});

test("a slow round trip is degraded as before", async () => {
  const report = await clickhouseHealth(context({ slow: true }));
  expect(report.status).toBe("warning");
  expect(report.score).toBe(75);
  expect(report.checks.find((c) => c.id === "response-time")?.ok).toBe(false);
});

test("an unreachable server is unavailable", async () => {
  const report = await clickhouseHealth(context({ unreachable: true }));
  expect(report.status).toBe("unavailable");
  expect(report.score).toBe(0);
  expect(ids(report)).toEqual(["authenticated-query"]);
});
