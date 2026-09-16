import { definePage, PageHeader } from "@northgraindata/dsui-adapter-sdk";
import { S3Workspace } from "../components/s3-workspace.js";

export const browserPage = definePage({
  path: "/buckets/:bucket",
  render: ({ params, query }) => {
    const prefix = query.get("prefix") ?? "";
    return [
      PageHeader({
        title: params.bucket,
        description: prefix ? `Prefix: ${prefix}` : "Object browser",
      }),
      S3Workspace({ mode: "explorer", bucket: params.bucket, prefix }),
    ];
  },
});
