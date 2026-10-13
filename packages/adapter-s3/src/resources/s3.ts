import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { S3Context } from "../context.js";

export const bucketInput = z.object({ bucket: z.string().min(1) });
export const objectInput = bucketInput.extend({ key: z.string().min(1) });

export const buckets = defineResource({
  id: "s3-buckets",
  query: (_, ctx: S3Context) => ctx.client.listBuckets(),
});
export const objects = defineResource({
  id: "s3-objects",
  input: bucketInput.extend({
    prefix: z.string().optional().default(""),
    token: z.string().optional(),
    search: z.boolean().optional(),
  }),
  query: (input, ctx: S3Context) => ctx.client.listObjects(input),
});
export const bucketInfo = defineResource({
  id: "s3-bucket-info",
  input: bucketInput,
  query: ({ bucket }, ctx: S3Context) => ctx.client.bucketInfo(bucket),
});
export const preview = defineResource({
  id: "s3-preview",
  input: objectInput,
  query: (input, ctx: S3Context) => ctx.client.preview(input),
});
export const versions = defineResource({
  id: "s3-versions",
  input: objectInput.extend({
    keyMarker: z.string().optional(),
    versionMarker: z.string().optional(),
  }),
  query: (input, ctx: S3Context) => ctx.client.versions(input),
});
export const objectDetails = defineResource({
  id: "s3-object-details",
  input: objectInput,
  query: (input, ctx: S3Context) => ctx.client.getObjectDetails(input),
});
