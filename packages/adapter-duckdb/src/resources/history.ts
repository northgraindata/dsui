import {
  defineResource,
  poll,
  type ResourceRuntimeContext,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import { queryHistoryStore } from "../stores/index.js";

type Ctx = DuckDbContext & ResourceRuntimeContext;

export const queryHistory = defineResource({
  id: "query-history",
  input: z.object({
    search: z.string().optional(),
    status: z.string().nullable().optional().default(null),
  }),
  query: ({ search, status }, ctx: Ctx) => {
    const entries = ctx.stores.get(queryHistoryStore).get().entries;
    return entries.filter(
      (entry) =>
        (!status || entry.status === status) &&
        (!search || entry.sql.includes(search)),
    );
  },
  refresh: poll("10s"),
});
