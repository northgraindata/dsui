import { defineComponent, z } from "@northgraindata/dsui-adapter-sdk";

export const S3Workspace = defineComponent({
  id: "s3/storage-workspace",
  path: "./components/storage-workspace.tsx",
  props: z.object({
    mode: z.enum([
      "overview",
      "explorer",
      "buckets",
      "uploads",
      "activity",
      "policies",
    ]),
    bucket: z.string().optional(),
    prefix: z.string().optional(),
  }),
});
