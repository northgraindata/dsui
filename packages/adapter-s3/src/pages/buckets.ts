import { definePage } from "@northgraindata/dsui-adapter-sdk";
import { S3Workspace } from "../components/s3-workspace.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [S3Workspace({ mode: "overview" })],
});

export const bucketsPage = definePage({
  path: "/buckets",
  render: () => [S3Workspace({ mode: "buckets" })],
});

export const explorerPage = definePage({
  path: "/explorer",
  render: () => [S3Workspace({ mode: "explorer" })],
});

export const activityPage = definePage({
  path: "/activity",
  render: () => [S3Workspace({ mode: "activity" })],
});
export const uploadsPage = definePage({
  path: "/uploads",
  render: () => S3Workspace({ mode: "uploads" }),
});
export const policiesPage = definePage({
  path: "/policies",
  render: () => S3Workspace({ mode: "policies" }),
});
