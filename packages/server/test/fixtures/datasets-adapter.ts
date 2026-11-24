import {
  type DatasetInfo,
  defineAdapter,
  defineDatasets,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const tables = ["public.customers", "public.orders", "public.payments"];

type Context = { mode: "ok" | "invalid" | "slow" | "failing" };

/** A tiny in-memory warehouse: three tables with predictable measures. */
export default defineAdapter<
  Context,
  { method: "memory"; mode: Context["mode"] }
>({
  metadata: {
    id: "datasets-fixture",
    name: "Datasets fixture",
    version: "1.0.0",
  },
  health: async () => ({ status: "healthy", score: 100, checks: [] }),
  connectionMethods: {
    memory: {
      label: "In memory",
      schema: z.object({
        mode: z.enum(["ok", "invalid", "slow", "failing"]).default("ok"),
      }),
    },
  },
  context: (config) => ({ mode: config.mode }),
  datasets: defineDatasets<Context>({
    async list({ cursor, limit }, ctx) {
      if (ctx.mode === "failing") throw new Error("catalog is unreachable");
      const start = cursor ? tables.indexOf(cursor) + 1 : 0;
      const slice = tables.slice(start, start + limit);
      const items: DatasetInfo[] = slice.map((name) => ({
        ref: { name },
        kind: "table",
        columns: [{ name: "id", type: "bigint", nullable: false }],
      }));
      const last = slice.at(-1);
      return {
        items,
        ...(last && start + limit < tables.length ? { nextCursor: last } : {}),
      };
    },
    async observe(refs, ctx) {
      if (ctx.mode === "slow") await Bun.sleep(5_000);
      if (ctx.mode === "invalid")
        return [
          { ref: refs[0] ?? { name: "x" }, at: "yesterday", rowCount: -1 },
        ];
      // A table that does not exist is simply left out.
      return refs
        .filter((ref) => tables.includes(ref.name))
        .map((ref) => ({
          ref,
          at: "2026-11-19T10:00:00.000Z",
          rowCount: tables.indexOf(ref.name) * 100,
          rowCountExact: false,
          changeCounter: 7,
        }));
    },
  }),
});
