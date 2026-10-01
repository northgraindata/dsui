import {
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

/**
 * Reports the health of a PostgreSQL service.
 *
 * Connection saturation is the signal that matters most here and cannot be
 * inferred from reachability: a server at full connection capacity still
 * answers this query, then rejects everything else. It is also the reason the
 * health probe runs a cheap scalar rather than reusing a resource query.
 */
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

  const checks = [
    reachabilityCheck(true, Date.now() - started),
    {
      id: "version",
      label: "Server version",
      ok: true,
      detail: version,
    },
  ];

  try {
    const rows = await ctx.client.execute(
      `select
         (select count(*)::integer from pg_stat_activity
           where datname = current_database()) as used,
         current_setting('max_connections')::integer as max`,
      1,
    );
    const row = rows.rows[0] as { used?: number; max?: number } | undefined;
    const limit = row?.max ?? 0;
    const used = row?.used ?? 0;
    if (limit > 0) {
      const usage = used / limit;
      checks.push({
        id: "connections",
        label: "Connection capacity",
        ok: usage < MAX_CONNECTION_USAGE,
        detail: `${used} of ${limit} in use (${Math.round(usage * 100)}%)`,
      });
    }
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

  return healthReport({
    checks,
    weights: {
      reachability: 1,
      // Saturation degrades the service; it does not mean it is down.
      connections: 0.3,
      version: 0,
    },
    latencyMs: Date.now() - started,
  });
}
