import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";

export const secrets = defineResource({
  id: "secrets",
  query: (_input: undefined, ctx: DuckDbContext) => ctx.client.listSecrets(),
});
