import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { activityStore } from "../activity.js";
import type { S3Context } from "../context.js";
import { objectDetails, objects } from "../resources/s3.js";

type Ctx = S3Context & ActionRuntimeContext;
const objectInput = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
});

export const deleteObjects = defineAction({
  id: "s3-delete-objects",
  input: z.object({
    bucket: z.string().min(1),
    keys: z.array(z.string().min(1)).min(1).max(1000),
    prefix: z.string().optional(),
  }),
  run: async ({ bucket, keys, prefix }, ctx: Ctx) => {
    await ctx.client.deleteObjects({ bucket, keys }, ctx.signal);
    record(ctx, "Deleted", bucket, keys.join(", "));
    ctx.invalidate(objects, { bucket, prefix: prefix ?? "" });
    ctx.invalidate(objectDetails);
    return { deleted: keys.length };
  },
});

function record(ctx: Ctx, operation: string, bucket: string, key: string) {
  const store = ctx.stores.get(activityStore);
  store.set({
    entries: [
      {
        id: crypto.randomUUID(),
        operation,
        bucket,
        key,
        at: new Date().toISOString(),
      },
      ...store.get().entries,
    ].slice(0, 200),
  });
}
export const readActivity = defineAction({
  id: "s3-read-activity",
  run: (_, ctx: Ctx) => ctx.stores.get(activityStore).get().entries,
});
export const uploadObject = defineAction({
  id: "s3-upload",
  input: objectInput.extend({
    base64: z.string().max(7_000_000),
    contentType: z.string().default("application/octet-stream"),
  }),
  run: async (input, ctx: Ctx) => {
    await ctx.client.upload(input);
    record(ctx, "Uploaded", input.bucket, input.key);
    ctx.invalidate(objects);
    return { key: input.key };
  },
});
export const createFolder = defineAction({
  id: "s3-create-folder",
  input: objectInput,
  run: async (input, ctx: Ctx) => {
    const key = input.key.endsWith("/") ? input.key : `${input.key}/`;
    await ctx.client.upload({
      ...input,
      key,
      base64: "",
      contentType: "application/x-directory",
    });
    record(ctx, "Created folder", input.bucket, key);
    ctx.invalidate(objects);
    return { key };
  },
});
export const copyObject = defineAction({
  id: "s3-copy",
  input: objectInput.extend({
    destinationBucket: z.string().min(1),
    destinationKey: z.string().min(1),
    move: z.boolean().default(false),
  }),
  run: async (input, ctx: Ctx) => {
    await ctx.client.copy(input);
    record(
      ctx,
      input.move ? "Moved" : "Copied",
      input.destinationBucket,
      input.destinationKey,
    );
    ctx.invalidate(objects);
    return { key: input.destinationKey };
  },
});

export const presignGet = defineAction({
  id: "s3-presign-get",
  input: objectInput.extend({
    expiresIn: z.coerce.number().int().min(60).max(604800).optional(),
  }),
  run: async (input, ctx: Ctx) => {
    const link = await ctx.client.presignGet(input, ctx.signal);
    record(ctx, "Generated presigned URL", input.bucket, input.key);
    return link;
  },
});

export const downloadFolderZip = defineAction({
  id: "s3-download-folder-zip",
  input: z.object({
    bucket: z.string().min(1),
    prefix: z.string().min(1),
  }),
  run: (input, ctx: Ctx) => ctx.client.downloadFolderZip(input, ctx.signal),
});
