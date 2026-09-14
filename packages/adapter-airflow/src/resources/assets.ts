import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";

export const assetInput = z.object({
  assetId: z.coerce.number().int().nonnegative(),
});

export const assets = defineResource({
  id: "assets",
  query: (_, ctx: AirflowContext) => ctx.client.listAssets(),
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
