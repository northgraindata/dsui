import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import {
  databaseSize,
  databases,
  overview,
  relations,
  schemas,
  tables,
  views,
} from "../resources/catalog.js";
import { queryHistory } from "../resources/history.js";

type Ctx = DuckDbContext & ActionRuntimeContext;

export const runQueryInput = z.object({ sql: z.string().min(1) });

export const runQuery = defineAction({
  id: "run-query",
  input: runQueryInput,
  run: async ({ sql }, ctx: Ctx) => {
    const started = Date.now();
    const result = await ctx.client.execute(sql, { signal: ctx.signal });
    ctx.invalidate(queryHistory);
    // The worksheet accepts arbitrary SQL, so a successful statement may have
    // changed any part of the catalog. Invalidating is intentionally broad here;
    // resources still reload lazily as their explorer branches become visible.
    ctx.invalidate(databases);
    ctx.invalidate(schemas);
    ctx.invalidate(relations);
    ctx.invalidate(tables);
    ctx.invalidate(views);
    ctx.invalidate(databaseSize);
    ctx.invalidate(overview);
    return { ...result, elapsedMs: Date.now() - started };
  },
});

export const cancelQuery = defineAction({
  id: "cancel-query",
  run: (_input, ctx: Ctx) => {
    ctx.client.interrupt();
    return { status: "CANCELLED" };
  },
});
