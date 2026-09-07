import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";
import { warehouses } from "../resources/warehouses.js";

type Ctx = SnowflakeContext & ActionRuntimeContext;

const warehouseInput = z.object({ warehouse: z.string().min(1) });

export const suspendWarehouse = defineAction({
  id: "suspend-warehouse",
  input: warehouseInput,
  run: async ({ warehouse }, ctx: Ctx) => {
    await ctx.client.suspendWarehouse(warehouse);
    ctx.invalidate(warehouses);
    return { warehouse, status: "SUSPENDED" };
  },
});

export const resumeWarehouse = defineAction({
  id: "resume-warehouse",
  input: warehouseInput,
  run: async ({ warehouse }, ctx: Ctx) => {
    await ctx.client.resumeWarehouse(warehouse);
    ctx.invalidate(warehouses);
    return { warehouse, status: "RUNNING" };
  },
});

export const resizeWarehouseInput = z.object({
  warehouse: z.string().min(1),
  size: z.enum(["XSMALL", "SMALL", "MEDIUM", "LARGE", "XLARGE"]),
});

export const resizeWarehouse = defineAction({
  id: "resize-warehouse",
  input: resizeWarehouseInput,
  run: async ({ warehouse, size }, ctx: Ctx) => {
    await ctx.client.resizeWarehouse(warehouse, size);
    ctx.invalidate(warehouses);
    return { warehouse, size };
  },
});

export const createWarehouseInput = z.object({
  name: z.string().min(1),
  size: z.enum(["XSMALL", "SMALL", "MEDIUM", "LARGE", "XLARGE"]),
});

export const createWarehouse = defineAction({
  id: "create-warehouse",
  input: createWarehouseInput,
  run: async ({ name, size }, ctx: Ctx) => {
    await ctx.client.createWarehouse({ name, size });
    ctx.invalidate(warehouses);
    return { name, size };
  },
});

export const dropWarehouse = defineAction({
  id: "drop-warehouse",
  input: warehouseInput,
  run: async ({ warehouse }, ctx: Ctx) => {
    await ctx.client.dropWarehouse(warehouse);
    ctx.invalidate(warehouses);
    return { warehouse, dropped: true };
  },
});
