import { statfs } from "node:fs/promises";
import {
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "./context.js";

/**
 * Fraction of the containing filesystem that may be used before a local
 * DuckDB file is reported as degraded.
 *
 * A database file that cannot grow is a real failure mode, and it is the one
 * health signal DuckDB can measure that connectivity cannot.
 */
const MAX_DISK_USAGE = 0.9;

/**
 * Reports the health of a DuckDB service.
 *
 * Signals differ per connection method because they answer different
 * questions: an in-memory database has no disk to fill, a local file does, and
 * a remote database is someone else's filesystem. Applying the disk check
 * unconditionally would report healthy remote services as broken.
 */
export async function duckdbHealth(ctx: DuckDbContext) {
  const started = Date.now();
  const checks = [];

  let version: string | undefined;
  try {
    version = await ctx.client.version();
    checks.push(reachabilityCheck(true, Date.now() - started));
  } catch (error) {
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail: error instanceof Error ? error.message : "DuckDB unreachable",
        },
      ],
      weights: { reachability: 1 },
    });
  }

  const method = ctx.config.method ?? (ctx.config.path ? "file" : "memory");
  if (method === "file" && ctx.config.path) {
    try {
      const info = await statfs(ctx.config.path);
      const usage = 1 - info.bavail / info.blocks;
      checks.push({
        id: "disk",
        label: "Filesystem headroom",
        ok: usage < MAX_DISK_USAGE,
        detail: `${Math.round(usage * 100)}% used`,
      });
      if (ctx.config.readOnly === false)
        checks.push({
          id: "writable",
          label: "Database writable",
          ok: true,
          detail: "Write mode enabled",
        });
    } catch (error) {
      checks.push({
        id: "disk",
        label: "Filesystem headroom",
        ok: false,
        detail:
          error instanceof Error
            ? `Filesystem unreachable: ${error.message}`
            : "Filesystem unreachable",
      });
    }
  }

  if (version) {
    checks.push({
      id: "version",
      label: "Engine version",
      ok: true,
      detail: `DuckDB ${version}`,
    });
  }

  return healthReport({
    checks,
    weights: {
      reachability: 1,
      // A nearly full disk degrades the service but does not break it, so it
      // costs a quarter of the score rather than all of it.
      disk: 0.25,
      writable: 0,
      version: 0,
    },
    latencyMs: Date.now() - started,
  });
}
