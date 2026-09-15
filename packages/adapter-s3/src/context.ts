import { z } from "@northgraindata/dsui-adapter-sdk";

export const s3ConnectionSchema = z.object({
  region: z.string().min(1).default("us-east-1"),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  forcePathStyle: z.coerce.boolean().default(false),
  publicEndpoint: z.string().url().optional(),
});

export type S3Config = z.output<typeof s3ConnectionSchema>;

export interface S3Bucket {
  name: string;
  createdAt: string;
  region: string;
}

export interface S3Object {
  bucket: string;
  key: string;
  name: string;
  type: "folder" | "object";
  size: number | null;
  lastModified: string;
  eTag: string;
  contentType: string;
  storageClass: string;
}

export interface S3ObjectDetails extends S3Object {
  metadata: Record<string, string>;
  tags: Record<string, string>;
  versionId: string | null;
  encryption?: string;
}

export interface ObjectPage {
  rows: S3Object[];
  nextToken?: string;
}
export interface BucketInfo {
  versioning: string;
  encryption: string;
  policy: string;
  objectCount: number;
  size: number;
  partial: boolean;
  multipartUploads: number;
  multipartPartial: boolean;
}
export interface Preview {
  kind: "text" | "image" | "binary";
  content: string;
  truncated: boolean;
}
export interface ObjectVersion {
  id: string;
  latest: boolean;
  deleted: boolean;
  size: number;
  modified: string;
}

export interface S3Client {
  dispose(): void;
  listBuckets(signal?: AbortSignal): Promise<S3Bucket[]>;
  listObjects(
    input: {
      bucket: string;
      prefix?: string;
      token?: string;
      search?: boolean;
    },
    signal?: AbortSignal,
  ): Promise<ObjectPage>;
  bucketInfo(bucket: string): Promise<BucketInfo>;
  preview(input: { bucket: string; key: string }): Promise<Preview>;
  versions(input: {
    bucket: string;
    key: string;
    keyMarker?: string;
    versionMarker?: string;
  }): Promise<{
    rows: ObjectVersion[];
    keyMarker?: string;
    versionMarker?: string;
  }>;
  upload(input: {
    bucket: string;
    key: string;
    base64: string;
    contentType: string;
  }): Promise<void>;
  copy(input: {
    bucket: string;
    key: string;
    destinationBucket: string;
    destinationKey: string;
    move: boolean;
  }): Promise<void>;
  getObjectDetails(
    input: { bucket: string; key: string },
    signal?: AbortSignal,
  ): Promise<S3ObjectDetails>;
  deleteObjects(
    input: { bucket: string; keys: string[] },
    signal?: AbortSignal,
  ): Promise<void>;
  presignGet(
    input: { bucket: string; key: string; expiresIn?: number },
    signal?: AbortSignal,
  ): Promise<{ url: string; expiresIn: number }>;
}

export interface S3Context {
  client: S3Client;
  config: S3Config;
}
export const createContext = (
  client: S3Client,
  config: S3Config,
): S3Context => ({ client, config });
