import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { S3Context } from "../context.js";

export const bucketInput = z.object({ bucket: z.string().min(1) });
export const objectInput = bucketInput.extend({ key: z.string().min(1) });

export const buckets = defineResource({
  id: "s3-buckets",
  description: "List visible S3 buckets and their names.",
  policy: "metadata",
  query: (_, ctx: S3Context) => ctx.client.listBuckets(),
});
export const objects = defineResource({
  id: "s3-objects",
  description:
    "List or search objects within one bucket, using prefix and pagination token.",
  policy: "metadata",
  input: bucketInput.extend({
    prefix: z.string().optional().default(""),
    token: z.string().optional(),
    search: z.boolean().optional(),
  }),
  query: (input, ctx: S3Context) => ctx.client.listObjects(input),
});
export const bucketInfo = defineResource({
  id: "s3-bucket-info",
  description: "Read metadata and configuration for one S3 bucket.",
  policy: "metadata",
  input: bucketInput,
  query: ({ bucket }, ctx: S3Context) => ctx.client.bucketInfo(bucket),
});
export const preview = defineResource({
  id: "s3-preview",
  description:
    "Preview the contents of one S3 object; requires preview access.",
  policy: "preview",
  input: objectInput,
  query: (input, ctx: S3Context) => ctx.client.preview(input),
});
export const versions = defineResource({
  id: "s3-versions",
  description:
    "List versions of one object using S3 version pagination markers.",
  policy: "metadata",
  input: objectInput.extend({
    keyMarker: z.string().optional(),
    versionMarker: z.string().optional(),
  }),
  query: (input, ctx: S3Context) => ctx.client.versions(input),
});
export const objectDetails = defineResource({
  id: "s3-object-details",
  description:
    "Read metadata for one S3 object without downloading its contents.",
  policy: "metadata",
  input: objectInput,
  query: (input, ctx: S3Context) => ctx.client.getObjectDetails(input),
});
