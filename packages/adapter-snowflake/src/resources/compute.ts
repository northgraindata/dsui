import { defineResource, poll } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

export const computePools = defineResource({
  id: "compute-pools",
  query: (_input: undefined, ctx: SnowflakeContext) =>
    ctx.client.listComputePools(),
  refresh: poll("30s"),
});
