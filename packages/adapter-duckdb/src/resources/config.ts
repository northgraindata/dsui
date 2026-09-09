import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";

export const extensions = defineResource({
  id: "extensions",
  query: (_input: undefined, ctx: DuckDbContext) => ctx.client.listExtensions(),
  refresh: poll("60s"),
});

export const extensionDetails = defineResource({
  id: "extension-details",
  input: z.object({ name: z.string() }),
  query: async ({ name }, ctx: DuckDbContext) => {
    const extension = (await ctx.client.listExtensions()).find(
      (candidate) => candidate.name === name,
    );
    if (!extension) throw new Error(`Extension not found: ${name}`);
    return extension;
  },
});

export const settings = defineResource({
  id: "settings",
  input: z.object({ search: z.string().optional() }),
  query: ({ search }, ctx: DuckDbContext) =>
    ctx.client.listSettings(search ?? ""),
  refresh: poll("60s"),
});

export const secrets = defineResource({
  id: "secrets",
  query: (_input: undefined, ctx: DuckDbContext) => ctx.client.listSecrets(),
});
