import { definePage, PageHeader } from "@northgraindata/dsui-adapter-sdk";
import { S3Workspace } from "../components/s3-workspace.js";

export const fileBrowserPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "Buckets",
      description: "Browse S3-compatible storage.",
    }),
    S3Workspace({ mode: "buckets" }),
  ],
});
