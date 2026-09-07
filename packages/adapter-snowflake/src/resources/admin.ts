import { defineResource, poll } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

export const accessHistory = defineResource({
  id: "access-history",
  query: (_input: undefined, ctx: SnowflakeContext) =>
    ctx.client.queryAccessHistory(),
  refresh: poll("60s"),
});

export const accountDetails = defineResource({
  id: "account-details",
  query: (_input: undefined, ctx: SnowflakeContext) => ctx.client.getAccount(),
});
