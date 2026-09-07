import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

export const users = defineResource({
  id: "users",
  query: (_input: undefined, ctx: SnowflakeContext) => ctx.client.listUsers(),
});

export const userDetails = defineResource({
  id: "user-details",
  input: z.object({ user: z.string() }),
  query: ({ user }, ctx: SnowflakeContext) => ctx.client.getUser(user),
});

export const roles = defineResource({
  id: "roles",
  query: (_input: undefined, ctx: SnowflakeContext) => ctx.client.listRoles(),
});

export const grants = defineResource({
  id: "grants",
  query: (_input: undefined, ctx: SnowflakeContext) => ctx.client.listGrants(),
});
