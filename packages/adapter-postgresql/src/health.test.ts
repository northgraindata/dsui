import { expect, test } from "bun:test";
import type { PostgreSQLContext } from "./context.js";
import { postgresqlHealth } from "./health.js";

type Row = Record<string, unknown>;

function context(options: {
  sessions?: Row | Error;
  replication?: Row | Error;
  unreachable?: boolean;
}): PostgreSQLContext {
  const respond = (value: Row | Error | undefined) => {
    if (value instanceof Error) throw value;
    return { rows: value ? [value] : [] };
  };
  return {
    client: {
      serverInfo: async () => {
        if (options.unreachable) throw new Error("connection refused");
        return { serverVersion: "16.2" };
      },
      execute: async (sql: string) =>
        sql.includes("pg_is_in_recovery")
          ? respond(options.replication)
          : respond(options.sessions),
    },
  } as unknown as PostgreSQLContext;
}

const sessions = (overrides: Row = {}) => ({
  used: 10,
  max: 100,
  long_running: 0,
  idle_in_transaction: 0,
  ...overrides,
});

const byId = (report: Awaited<ReturnType<typeof postgresqlHealth>>) =>
  new Map(report.checks.map((check) => [check.id, check]));

test("a quiet primary is healthy and reports every session check", async () => {
  const report = await postgresqlHealth(
    context({
      sessions: sessions(),
      replication: { replica: false, lag_seconds: 0 },
    }),
  );
  expect(report.status).toBe("healthy");
  expect(report.score).toBe(100);
  expect([...byId(report).keys()]).toEqual([
    "reachability",
    "version",
    "connections",
    "long-running-queries",
    "idle-in-transaction",
  ]);
});

test("long-running queries degrade the service and link to live activity", async () => {
  const report = await postgresqlHealth(
    context({ sessions: sessions({ long_running: 3 }) }),
  );
  const check = byId(report).get("long-running-queries");
  expect(check).toMatchObject({ ok: false, href: "/activity" });
  expect(check?.detail).toContain("3 running");
  expect(report.status).toBe("warning");
  expect(report.score).toBe(85);
});

test("sessions idle in a transaction are reported", async () => {
  const report = await postgresqlHealth(
    context({ sessions: sessions({ idle_in_transaction: 2 }) }),
  );
  expect(byId(report).get("idle-in-transaction")).toMatchObject({ ok: false });
  expect(report.status).toBe("warning");
});

test("connection saturation still degrades at eighty percent", async () => {
  const report = await postgresqlHealth(
    context({ sessions: sessions({ used: 85 }) }),
  );
  expect(byId(report).get("connections")).toMatchObject({ ok: false });
});

test("a lagging replica is reported, a primary reports no lag check", async () => {
  const lagging = await postgresqlHealth(
    context({
      sessions: sessions(),
      replication: { replica: true, lag_seconds: 240 },
    }),
  );
  expect(byId(lagging).get("replication-lag")).toMatchObject({
    ok: false,
    detail: "240 s behind the primary",
  });
  expect(lagging.status).toBe("warning");
  const primary = await postgresqlHealth(
    context({
      sessions: sessions(),
      replication: { replica: false, lag_seconds: 0 },
    }),
  );
  expect(byId(primary).has("replication-lag")).toBe(false);
});

test("a role that cannot read activity is not blamed for it", async () => {
  const report = await postgresqlHealth(
    context({
      sessions: new Error("permission denied for view pg_stat_activity"),
      replication: new Error("permission denied"),
    }),
  );
  expect(report.status).toBe("healthy");
  expect(byId(report).get("connections")?.detail).toContain("Not observable");
  expect(byId(report).has("replication-lag")).toBe(false);
});

test("an unreachable server is unavailable", async () => {
  const report = await postgresqlHealth(context({ unreachable: true }));
  expect(report.status).toBe("unavailable");
});
