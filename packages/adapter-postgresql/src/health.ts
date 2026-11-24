import {
  type AdapterHealthCheck,
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "./context.js";

/**
 * Fraction of `max_connections` above which the server is reported as
 * degraded.
 *
 * PostgreSQL refuses new connections before it becomes visibly slow, so
 * saturation is a leading indicator rather than a lagging one.
 */
const MAX_CONNECTION_USAGE = 0.8;

/** A query running longer than this is worth a look. */
const LONG_RUNNING_MINUTES = 5;

/**
 * A session idle inside a transaction this long holds locks and blocks
 * vacuum, which is how a quiet application bug becomes an outage.
 */
const IDLE_IN_TRANSACTION_MINUTES = 5;

/** A replica further behind than this serves stale reads. */
const MAX_REPLICATION_LAG_SECONDS = 60;

/** Where an operator can inspect live sessions. */
const ACTIVITY_PATH = "/activity";

/**
 * Reports the health of a PostgreSQL service.
 *
 * Connection saturation is the signal that matters most here and cannot be
 * inferred from reachability: a server at full connection capacity still
 * answers this query, then rejects everything else. It is also the reason the
 * health probe runs a cheap scalar rather than reusing a resource query.
 */
/**
 * Connection saturation and session health, from one read of the activity view.
 *
 * One query rather than three: health runs on every probe of every service, so
 * each extra round trip is paid thousands of times a day.
 */
async function observeSessions(
  ctx: PostgreSQLContext,
  checks: AdapterHealthCheck[],
) {
  try {
    const rows = await ctx.client.execute(
      `select
         count(*) filter (where datname = current_database())::integer as used,
         current_setting('max_connections')::integer as max,
         count(*) filter (
           where state = 'active' and pid <> pg_backend_pid()
             and query_start < now() - interval '${LONG_RUNNING_MINUTES} minutes'
         )::integer as long_running,
         count(*) filter (
           where state = 'idle in transaction'
             and state_change < now() - interval '${IDLE_IN_TRANSACTION_MINUTES} minutes'
         )::integer as idle_in_transaction
       from pg_stat_activity`,
      1,
    );
    const row = rows.rows[0] as
      | {
          used?: number;
          max?: number;
          long_running?: number;
          idle_in_transaction?: number;
        }
      | undefined;
    const limit = row?.max ?? 0;
    const used = row?.used ?? 0;
    if (limit > 0) {
      const usage = used / limit;
      checks.push({
        id: "connections",
        label: "Connection capacity",
        ok: usage < MAX_CONNECTION_USAGE,
        detail: `${used} of ${limit} in use (${Math.round(usage * 100)}%)`,
        href: ACTIVITY_PATH,
      });
    }
    const longRunning = row?.long_running ?? 0;
    checks.push({
      id: "long-running-queries",
      label: "Long-running queries",
      ok: longRunning === 0,
      detail:
        longRunning === 0
          ? `None over ${LONG_RUNNING_MINUTES} minutes`
          : `${longRunning} running for over ${LONG_RUNNING_MINUTES} minutes`,
      href: ACTIVITY_PATH,
    });
    const idle = row?.idle_in_transaction ?? 0;
    checks.push({
      id: "idle-in-transaction",
      label: "Idle in transaction",
      ok: idle === 0,
      detail:
        idle === 0
          ? `None over ${IDLE_IN_TRANSACTION_MINUTES} minutes`
          : `${idle} idle in a transaction for over ${IDLE_IN_TRANSACTION_MINUTES} minutes`,
      href: ACTIVITY_PATH,
    });
  } catch (error) {
    // A restricted role may not read `pg_stat_activity`. That is a gap in what
    // DSUI can observe, not evidence of a problem, so it is reported as an
    // unknown signal rather than a failure.
    checks.push({
      id: "connections",
      label: "Connection capacity",
      ok: true,
      detail: `Not observable: ${
        error instanceof Error ? error.message : "permission denied"
      }`,
    });
  }
}

/** Replication lag, reported only when the server is a replica. */
async function observeReplication(
  ctx: PostgreSQLContext,
  checks: AdapterHealthCheck[],
) {
  try {
    const rows = await ctx.client.execute(
      `select
         pg_is_in_recovery() as replica,
         coalesce(extract(epoch from now() - pg_last_xact_replay_timestamp()), 0)::float as lag_seconds`,
      1,
    );
    const row = rows.rows[0] as
      | { replica?: boolean; lag_seconds?: number }
      | undefined;
    if (!row?.replica) return;
    const lag = Math.max(0, Math.round(row.lag_seconds ?? 0));
    checks.push({
      id: "replication-lag",
      label: "Replication lag",
      ok: lag <= MAX_REPLICATION_LAG_SECONDS,
      detail: `${lag} s behind the primary`,
    });
  } catch {
    // Not observable on this role or version; absence is the honest answer.
  }
}

export async function postgresqlHealth(ctx: PostgreSQLContext) {
  const started = Date.now();
  let version: string;
  try {
    version = (await ctx.client.serverInfo()).serverVersion;
  } catch (error) {
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail:
            error instanceof Error ? error.message : "PostgreSQL unreachable",
        },
      ],
      weights: { reachability: 1 },
    });
  }

  const checks: AdapterHealthCheck[] = [
    reachabilityCheck(true, Date.now() - started),
    {
      id: "version",
      label: "Server version",
      ok: true,
      detail: version,
    },
  ];

  await observeSessions(ctx, checks);
  await observeReplication(ctx, checks);

  return healthReport({
    checks,
    weights: {
      reachability: 1,
      // Each of these degrades the service; none of them means it is down.
      connections: 0.3,
      "long-running-queries": 0.15,
      "idle-in-transaction": 0.15,
      "replication-lag": 0.3,
      version: 0,
    },
    latencyMs: Date.now() - started,
  });
}
