import { definePage } from "@northgraindata/dsui-adapter-sdk";
import { S3Workspace } from "../components/s3-workspace.js";

export const browserPage = definePage({
  path: "/buckets/:bucket",
  render: ({ params, query }) => {
    const prefix = query.get("prefix") ?? "";
    return S3Workspace({ mode: "explorer", bucket: params.bucket, prefix });
  },
});
