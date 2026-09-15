import {
  definePage,
  KeyValue,
  PageHeader,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { S3Workspace } from "../components/s3-workspace.js";
import { objectDetails } from "../resources/s3.js";

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

export const objectPage = definePage({
  path: "/buckets/:bucket/objects/:key",
  render: ({ params }) => [
    PageHeader({
      title: params.key,
      description: "Object metadata and preview controls.",
    }),
    Tabs({
      items: [
        {
          label: "Details",
          content: KeyValue({ source: objectDetails(params) }),
        },
      ],
    }),
  ],
});
