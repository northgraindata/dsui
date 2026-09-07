import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

export const warehouses = defineResource({
  id: "warehouses",
  query: (_input: undefined, ctx: SnowflakeContext) =>
    ctx.client.listWarehouses(),
  refresh: poll("5s"),
});

export const warehouseDetails = defineResource({
  id: "warehouse-details",
  input: z.object({ warehouse: z.string() }),
  query: ({ warehouse }, ctx: SnowflakeContext) =>
    ctx.client.getWarehouse(warehouse),
  refresh: poll("5s"),
});
