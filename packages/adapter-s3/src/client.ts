import {
  S3Client as AwsS3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetBucketEncryptionCommand,
  GetBucketLocationCommand,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3Bucket, S3Client, S3Config, S3Object } from "./context.js";

const iso = (value: Date | undefined) => value?.toISOString() ?? "";

export function createS3Client(config: S3Config): S3Client {
  const client = new AwsS3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    followRegionRedirects: true,
  });
  const signingClient = config.publicEndpoint
    ? new AwsS3Client({
        region: config.region,
        endpoint: config.publicEndpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      })
    : client;
  return {
    dispose: () => {
      client.destroy();
      if (signingClient !== client) signingClient.destroy();
    },
    listBuckets: async (signal) => {
      const result = await client.send(new ListBucketsCommand({}), {
        abortSignal: signal,
      });
      return Promise.all(
        (result.Buckets ?? [])
          .filter((bucket) => bucket.Name)
          .map(async (bucket): Promise<S3Bucket> => {
            const name = bucket.Name;
            if (!name) throw new Error("S3 returned a bucket without a name");
            const location = await client.send(
              new GetBucketLocationCommand({ Bucket: name }),
              { abortSignal: signal },
            );
            return {
              name,
              createdAt: iso(bucket.CreationDate),
              region: location.LocationConstraint || "us-east-1",
            };
          }),
      );
    },
    listObjects: async ({ bucket, prefix = "", token, search }, signal) => {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: search ? undefined : "/",
          MaxKeys: 50,
          ContinuationToken: token,
        }),
        { abortSignal: signal },
      );
      const folders: S3Object[] = (result.CommonPrefixes ?? []).flatMap(
        (item) =>
          item.Prefix
            ? [
                {
                  bucket,
                  key: item.Prefix,
                  name: item.Prefix.slice(prefix.length).replace(/\/$/, ""),
                  type: "folder" as const,
                  size: null,
                  lastModified: "",
                  eTag: "",
                  contentType: "",
                  storageClass: "",
                },
              ]
            : [],
      );
      const objects: S3Object[] = (result.Contents ?? []).flatMap((item) =>
        !item.Key || item.Key === prefix
          ? []
          : [
              {
                bucket,
                key: item.Key,
                name: item.Key.slice(prefix.length),
                type: "object" as const,
                size: item.Size ?? 0,
                lastModified: iso(item.LastModified),
                eTag: item.ETag ?? "",
                contentType: "",
                storageClass: item.StorageClass ?? "STANDARD",
              },
            ],
      );
      return {
        rows: [...folders, ...objects],
        nextToken: result.NextContinuationToken,
      };
    },
    getObjectDetails: async ({ bucket, key }, signal) => {
      const [result, tagging] = await Promise.all([
        client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), {
          abortSignal: signal,
        }),
        client.send(new GetObjectTaggingCommand({ Bucket: bucket, Key: key }), {
          abortSignal: signal,
        }),
      ]);
      return {
        bucket,
        key,
        name: key.split("/").at(-1) ?? key,
        type: "object",
        size: result.ContentLength ?? 0,
        lastModified: iso(result.LastModified),
        eTag: result.ETag ?? "",
        contentType: result.ContentType ?? "application/octet-stream",
        storageClass: result.StorageClass ?? "STANDARD",
        metadata: result.Metadata ?? {},
        tags: Object.fromEntries(
          (tagging.TagSet ?? []).flatMap((tag) =>
            tag.Key ? [[tag.Key, tag.Value ?? ""]] : [],
          ),
        ),
        versionId: result.VersionId ?? null,
        encryption: result.ServerSideEncryption ?? "Not specified",
      };
    },
    deleteObjects: async ({ bucket, keys }, signal) => {
      if (!keys.length) return;
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
        { abortSignal: signal },
      );
      if (result.Errors?.length)
        throw new Error(
          result.Errors.map((error) => `${error.Key}: ${error.Message}`).join(
            "; ",
          ),
        );
    },
    presignGet: async ({ bucket, key, expiresIn = 900 }) => ({
      url: await getSignedUrl(
        signingClient,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        {
          expiresIn,
        },
      ),
      expiresIn,
    }),
    bucketInfo: async (bucket) => {
      const optional = async <T>(promise: Promise<T>): Promise<T | string> => {
        try {
          return await promise;
        } catch (error) {
          return error instanceof Error ? error.message : "Unavailable";
        }
      };
      const [version, encryption, policy, uploads, listing] = await Promise.all(
        [
          optional(
            client.send(new GetBucketVersioningCommand({ Bucket: bucket })),
          ),
          optional(
            client.send(new GetBucketEncryptionCommand({ Bucket: bucket })),
          ),
          optional(client.send(new GetBucketPolicyCommand({ Bucket: bucket }))),
          optional(
            client.send(
              new ListMultipartUploadsCommand({
                Bucket: bucket,
                MaxUploads: 1000,
              }),
            ),
          ),
          client.send(
            new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000 }),
          ),
        ],
      );
      return {
        versioning:
          typeof version === "string"
            ? version
            : (version.Status ?? "Disabled"),
        encryption:
          typeof encryption === "string"
            ? encryption
            : encryption.ServerSideEncryptionConfiguration?.Rules?.map(
                (rule) => rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm,
              ).join(", ") || "Not configured",
        policy:
          typeof policy === "string"
            ? policy
            : (policy.Policy ?? "No bucket policy"),
        objectCount: listing.Contents?.length ?? 0,
        size: (listing.Contents ?? []).reduce(
          (sum, object) => sum + (object.Size ?? 0),
          0,
        ),
        partial: listing.IsTruncated ?? false,
        multipartUploads:
          typeof uploads === "string" ? -1 : (uploads.Uploads?.length ?? 0),
        multipartPartial:
          typeof uploads !== "string" && Boolean(uploads.IsTruncated),
      };
    },
    preview: async ({ bucket, key }) => {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      const contentType = head.ContentType ?? "";
      const image = /^image\/(png|jpeg|gif|webp)$/.test(contentType);
      const text =
        /^text\//.test(contentType) ||
        /\.(json|csv|txt|log)$/i.test(key) ||
        contentType === "application/json";
      const limit = image ? 2 * 1024 * 1024 : 128 * 1024;
      if (head.ContentLength === 0)
        return { kind: "text", content: "Empty object", truncated: false };
      if ((!image && !text) || (image && (head.ContentLength ?? 0) > limit))
        return {
          kind: "binary",
          content:
            "Preview unavailable for this format or image size. Download to inspect.",
          truncated: false,
        };
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          Range: `bytes=0-${limit - 1}`,
        }),
      );
      const bytes =
        (await result.Body?.transformToByteArray()) ?? new Uint8Array();
      return {
        kind: image ? "image" : "text",
        content: image
          ? `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`
          : new TextDecoder().decode(bytes),
        truncated: (head.ContentLength ?? 0) > limit,
      };
    },
    versions: async ({ bucket, key, keyMarker, versionMarker }) => {
      const result = await client.send(
        new ListObjectVersionsCommand({
          Bucket: bucket,
          Prefix: key,
          MaxKeys: 50,
          KeyMarker: keyMarker,
          VersionIdMarker: versionMarker,
        }),
      );
      return {
        rows: [
          ...(result.Versions ?? [])
            .filter((v) => v.Key === key)
            .map((v) => ({
              id: v.VersionId ?? "null",
              latest: Boolean(v.IsLatest),
              deleted: false,
              size: v.Size ?? 0,
              modified: iso(v.LastModified),
            })),
          ...(result.DeleteMarkers ?? [])
            .filter((v) => v.Key === key)
            .map((v) => ({
              id: v.VersionId ?? "null",
              latest: Boolean(v.IsLatest),
              deleted: true,
              size: 0,
              modified: iso(v.LastModified),
            })),
        ],
        keyMarker: result.NextKeyMarker,
        versionMarker: result.NextVersionIdMarker,
      };
    },
    upload: async ({ bucket, key, base64, contentType }) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(base64, "base64"),
          ContentType: contentType,
          IfNoneMatch: "*",
        }),
      );
    },
    copy: async ({ bucket, key, destinationBucket, destinationKey, move }) => {
      if (bucket === destinationBucket && key === destinationKey)
        throw new Error("Choose a different destination key.");
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      if ((head.ContentLength ?? 0) > 5 * 1024 ** 3)
        throw new Error("Copy is limited to objects up to 5 GiB.");
      await client.send(
        new CopyObjectCommand({
          Bucket: destinationBucket,
          Key: destinationKey,
          CopySource: `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`,
          CopySourceIfMatch: head.ETag,
        }),
      );
      if (move)
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
            IfMatch: head.ETag,
          }),
        );
    },
  };
}
