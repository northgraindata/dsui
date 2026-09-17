import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext } from "../context.js";

export const overview = defineResource({
  id: "overview",
  query: async (_input: undefined, ctx: DbtContext) => {
    if (ctx.config.method === "local")
      return {
        method: "local",
        projectPath: ctx.config.projectPath,
        executable: ctx.config.executable,
        version: await ctx.local?.version(),
      };
    const account = await ctx.cloud?.getAccount();
    if (!account) throw new Error("dbt Cloud client is unavailable");
    return {
      method: "cloud",
      accountId: account.id,
      accountName: account.name ?? account.id,
      state: account.state ?? "unknown",
    };
  },
});
