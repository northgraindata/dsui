import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

export const warehouseSpend = defineResource({
  id: "warehouse-spend",
  input: z.object({ days: z.number().int().min(1).max(365).default(7) }),
  query: ({ days }, ctx: SnowflakeContext) => ctx.client.warehouseSpend(days),
});

export const budgets = defineResource({
  id: "budgets",
  query: (_input: undefined, ctx: SnowflakeContext) => ctx.client.listBudgets(),
});

export const monitors = defineResource({
  id: "resource-monitors",
  query: (_input: undefined, ctx: SnowflakeContext) =>
    ctx.client.listMonitors(),
  refresh: poll("30s"),
});
