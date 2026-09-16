import { definePage } from "@northgraindata/dsui-adapter-sdk";
import { S3Workspace } from "../components/s3-workspace.js";

export const fileBrowserPage = definePage({
  path: "/",
  render: () => [S3Workspace({ mode: "explorer" })],
});
