import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";
import { formatRunTimestamp } from "./format.js";

export const assetInput = z.object({
  assetId: z.coerce.number().int().nonnegative(),
});

export const assets = defineResource({
  id: "assets",
  query: async (_, ctx: AirflowContext) =>
    (await ctx.client.listAssets()).map((asset) => {
      const updated = formatRunTimestamp(asset.updatedAt);
      return {
        ...asset,
        producerLabel: asset.producingTasks
          ? `Produced by ${asset.producingTasks}`
          : "",
        updatedLabel: updated === "—" ? "" : `Updated ${updated}`,
      };
    }),
  refresh: poll("30s"),
});

export const assetDetails = defineResource({
  id: "asset-details",
  input: assetInput,
  query: ({ assetId }, ctx: AirflowContext) => ctx.client.getAsset(assetId),
  refresh: poll("30s"),
});

export const assetEvents = defineResource({
  id: "asset-events",
  input: assetInput,
  query: ({ assetId }, ctx: AirflowContext) =>
    ctx.client.listAssetEvents(assetId),
  refresh: poll("10s"),
});
