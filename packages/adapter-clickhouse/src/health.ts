import {
  type AdapterHealthCheck,
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { ClickHouseContext } from "./context.js";

/** A round trip slower than this is reported as degraded. */
const SLOW_RESPONSE_MS = 1000;
/**
 * More active parts than this in one partition means inserts are outpacing
 * merges. ClickHouse starts slowing and then rejecting inserts well above it,
 * so this is early warning rather than an outage.
 */
const MAX_PARTS_PER_PARTITION = 300;
/** A replica this far behind serves stale data. */
const MAX_REPLICA_DELAY_SECONDS = 300;
/** Free space below this share of a disk leaves little room for merges. */
const MIN_FREE_DISK_SHARE = 0.1;

/**
 * Reports the health of a ClickHouse service.
 *
 * The extra checks read cheap server metrics rather than scanning system
 * tables such as `system.parts`, because health runs on every probe and a
 * large cluster has millions of parts. A check whose view the role cannot
 * read is left out: absence is the honest answer for something unobservable.
 */
export async function clickhouseHealth(ctx: ClickHouseContext) {
  const started = Date.now();
  try {
    await ctx.client.execute("SELECT 1 AS reachable");
  } catch {
    return healthReport({
      checks: [
        {
          id: "authenticated-query",
          label: "Authenticated SQL",
          ok: false,
          detail: "Connection or authenticated SQL probe failed.",
        },
      ],
      weights: { "authenticated-query": 1 },
    });
  }
  const latencyMs = Date.now() - started;
  const checks: AdapterHealthCheck[] = [
    { id: "authenticated-query", label: "Authenticated SQL", ok: true },
    {
      id: "response-time",
      label: "Response time",
      ok: latencyMs <= SLOW_RESPONSE_MS,
      detail: `${latencyMs} ms`,
    },
    ...(await observe(ctx)),
  ];
  return healthReport({
    checks,
    weights: {
      "authenticated-query": 1,
      "response-time": 0.25,
      replicas: 0.4,
      parts: 0.2,
      disk: 0.3,
    },
    latencyMs,
  });
}

type Reader = (sql: string) => Promise<Record<string, unknown> | undefined>;

async function observe(ctx: ClickHouseContext): Promise<AdapterHealthCheck[]> {
  const read: Reader = async (sql) =>
    (await ctx.client.execute(sql, { maxRows: 1 })).rows[0];
  const checks = await Promise.all([replicas(read), parts(read), disk(read)]);
  return checks.filter((check): check is AdapterHealthCheck => check !== null);
}

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function replicas(read: Reader): Promise<AdapterHealthCheck | null> {
  try {
    const row = await read(
      `SELECT count() AS total, countIf(is_readonly) AS readonly,
              max(absolute_delay) AS max_delay
       FROM system.replicas`,
    );
    const total = number(row?.total) ?? 0;
    if (total === 0) return null;
    const readonly = number(row?.readonly) ?? 0;
    const delay = number(row?.max_delay) ?? 0;
    const ok = readonly === 0 && delay <= MAX_REPLICA_DELAY_SECONDS;
    return {
      id: "replicas",
      label: "Replicas",
      ok,
      detail:
        readonly > 0
          ? `${readonly} of ${total} replicas read-only`
          : `${total} replicas, up to ${delay} s behind`,
    };
  } catch {
    return null;
  }
}

async function parts(read: Reader): Promise<AdapterHealthCheck | null> {
  try {
    const row = await read(
      `SELECT value FROM system.asynchronous_metrics
       WHERE metric = 'MaxPartCountForPartition'`,
    );
    const count = number(row?.value);
    if (count === null) return null;
    return {
      id: "parts",
      label: "Parts per partition",
      ok: count <= MAX_PARTS_PER_PARTITION,
      detail: `Up to ${Math.round(count)} active parts in one partition`,
    };
  } catch {
    return null;
  }
}

async function disk(read: Reader): Promise<AdapterHealthCheck | null> {
  try {
    const row = await read(
      `SELECT min(free_space / total_space) AS free
       FROM system.disks WHERE total_space > 0`,
    );
    const free = number(row?.free);
    if (free === null) return null;
    return {
      id: "disk",
      label: "Disk space",
      ok: free >= MIN_FREE_DISK_SHARE,
      detail: `${Math.round(free * 100)}% free on the fullest disk`,
    };
  } catch {
    return null;
  }
}
