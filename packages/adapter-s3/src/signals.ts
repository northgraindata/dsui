import { defineSignal, z } from "@northgraindata/dsui-adapter-sdk";

export const objectUploaded = defineSignal({
  id: "object-uploaded",
  type: "success",
  schema: z.object({
    bucket: z.string(),
    key: z.string(),
    contentType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
  }),
});

export const objectsDeleted = defineSignal({
  id: "objects-deleted",
  type: "success",
  schema: z.object({
    bucket: z.string(),
    keys: z.array(z.string()),
    deletedCount: z.number().int().nonnegative(),
  }),
});

export const s3Signals = [objectUploaded, objectsDeleted] as const;
