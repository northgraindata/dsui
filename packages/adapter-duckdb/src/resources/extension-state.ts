import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import { extensionRows } from "./extension-model.js";

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

export const extensionCatalog = defineResource({
  id: "extension-catalog",
  query: async (_: undefined, ctx: DuckDbContext) =>
    extensionRows(await ctx.client.listExtensions()),
});
