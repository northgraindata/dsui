import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import {
  copyObject,
  createFolder,
  deleteObjects,
  presignGet,
  readActivity,
  uploadObject,
} from "./actions/objects.js";
import { activityStore } from "./activity.js";
import { createS3Client } from "./client.js";
import {
  createContext,
  type S3Client,
  type S3Config,
  s3ConnectionSchema,
} from "./context.js";
import { browserPage, objectPage } from "./pages/browser.js";
import {
  activityPage,
  bucketsPage,
  explorerPage,
  overviewPage,
  policiesPage,
  uploadsPage,
} from "./pages/buckets.js";
import {
  bucketInfo,
  buckets,
  objectDetails,
  objects,
  preview,
  versions,
} from "./resources/s3.js";

export function createS3Adapter(
  createClient: (config: S3Config) => S3Client = createS3Client,
) {
  return defineAdapter({
    metadata: {
      id: "s3",
      name: "S3",
      version: "0.1.0",
      author: "DSUI",
      iconUrl:
        "https://icon.icepanel.io/AWS/svg/Storage/Simple-Storage-Service.svg",
      description: "Browse and manage S3-compatible object storage.",
    },
    connectionMethods: {
      s3: {
        label: "S3-compatible storage",
        description: "AWS S3, MinIO, or a compatible endpoint.",
        schema: s3ConnectionSchema,
      },
    },
    context: async (config: S3Config) => {
      const client = createClient(config);
      try {
        await client.listBuckets();
        return createContext(client, config);
      } catch (error) {
        client.dispose();
        throw error;
      }
    },
    disposeContext: (ctx) => ctx.client.dispose(),
    stores: [activityStore],
    resources: [buckets, objects, objectDetails, bucketInfo, preview, versions],
    actions: [
      deleteObjects,
      presignGet,
      uploadObject,
      createFolder,
      copyObject,
      readActivity,
    ],
    pages: [
      overviewPage,
      bucketsPage,
      explorerPage,
      uploadsPage,
      activityPage,
      policiesPage,
      browserPage,
      objectPage,
    ],
  });
}

export const s3Adapter = createS3Adapter();

export default s3Adapter;
