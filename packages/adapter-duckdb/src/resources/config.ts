import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";

export const settings = defineResource({
  id: "settings",
  input: z.object({ search: z.string().optional() }),
  query: ({ search }, ctx: DuckDbContext) =>
    ctx.client.listSettings(search ?? ""),
  refresh: poll("60s"),
});
