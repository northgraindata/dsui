import { GetObjectCommand, HeadObjectCommand, ListBucketsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { ADAPTER_SDK_VERSION, defineAdapter, z } from "@dsui/adapter-sdk";

const connectionSchema = z.object({ endpoint: z.string().url().optional(), region: z.string().min(1).default("us-east-1"), accessKeyId: z.string().optional(), secretAccessKey: z.string().optional(), sessionToken: z.string().optional(), forcePathStyle: z.boolean().default(true) }).superRefine((v, ctx) => { if (Boolean(v.accessKeyId) !== Boolean(v.secretAccessKey)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Both access key and secret access key are required" }); });
type Connection = z.output<typeof connectionSchema>;
const objectsInput = z.object({ bucket: z.string().min(1), prefix: z.string().default(""), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(1000).default(100) });
const headInput = z.object({ bucket: z.string().min(1), key: z.string().min(1) });
const getInput = headInput.extend({ previewBytes: z.coerce.number().int().min(1).max(1024 * 1024).optional() });

function clientFor(connection: Connection) {
  return new S3Client({ region: connection.region, endpoint: connection.endpoint, forcePathStyle: connection.forcePathStyle, credentials: connection.accessKeyId && connection.secretAccessKey ? { accessKeyId: connection.accessKeyId, secretAccessKey: connection.secretAccessKey, sessionToken: connection.sessionToken } : undefined });
}
function serialiseObject(object: { Key?: string; Size?: number; LastModified?: Date; ETag?: string; StorageClass?: string }) { return { key: object.Key, size: object.Size, updatedAt: object.LastModified?.toISOString(), etag: object.ETag, storageClass: object.StorageClass }; }

export const s3Adapter = defineAdapter({
  id: "s3", version: "0.1.0", sdkVersion: ADAPTER_SDK_VERSION,
  metadata: { id: "s3", name: "S3", category: "Object storage", description: "Browse signed S3-compatible buckets and objects.", icon: "s3" }, connectionSchema,
  connectionFields: [{ id: "endpoint", label: "Endpoint", type: "url", placeholder: "http://minio:9000" }, { id: "region", label: "Region", type: "text", placeholder: "us-east-1" }, { id: "accessKeyId", label: "Access key ID", type: "text", secret: true }, { id: "secretAccessKey", label: "Secret access key", type: "password", secret: true }, { id: "sessionToken", label: "Session token", type: "password", secret: true }, { id: "forcePathStyle", label: "Use path-style URLs", type: "boolean" }], secretPaths: ["accessKeyId", "secretAccessKey", "sessionToken"],
  capabilities: [
    { id: "service-info", authorization: "inspect", view: { kind: "service-info", title: "Storage service" } },
    { id: "buckets", authorization: "inspect", view: { kind: "object-browser", title: "Buckets", columns: [{ id: "name", label: "Bucket", format: "code" }, { id: "createdAt", label: "Created", format: "timestamp" }] } },
    { id: "objects", authorization: "inspect", supportsPagination: true, maxPageSize: 1000, view: { kind: "object-browser", title: "Objects", columns: [{ id: "key", label: "Object", format: "code" }, { id: "size", label: "Size", format: "bytes" }, { id: "updatedAt", label: "Modified", format: "timestamp" }] } },
    { id: "object-head", authorization: "inspect", view: { kind: "object-browser", title: "Object details" } },
    { id: "object-get", authorization: "inspect", view: { kind: "object-browser", title: "Download or preview" } },
  ],
  create(context, connection) {
    const client = clientFor(connection);
    return {
      async health() { const started = Date.now(); try { await client.send(new ListBucketsCommand({}), { abortSignal: context.signal }); return { status: "healthy", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started }; } catch { return { status: "unavailable", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, detail: "Unable to authenticate with S3 endpoint" }; } },
      async execute(operationId, input) {
        if (operationId === "service-info") return { items: [{ label: "Endpoint", value: connection.endpoint ?? "AWS regional endpoint", format: "code" }, { label: "Region", value: connection.region, format: "code" }] };
        if (operationId === "buckets") { const result = await client.send(new ListBucketsCommand({}), { abortSignal: context.signal }); return { items: (result.Buckets ?? []).map((bucket) => ({ name: bucket.Name, createdAt: bucket.CreationDate?.toISOString() })) }; }
        if (operationId === "objects") { const { bucket, prefix, cursor, limit } = objectsInput.parse(input); const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: cursor, MaxKeys: limit }), { abortSignal: context.signal }); return { items: (result.Contents ?? []).map(serialiseObject), nextCursor: result.NextContinuationToken }; }
        if (operationId === "object-head") { const { bucket, key } = headInput.parse(input); const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: context.signal }); return { key, size: result.ContentLength, contentType: result.ContentType, updatedAt: result.LastModified?.toISOString(), etag: result.ETag, metadata: result.Metadata ?? {} }; }
        if (operationId === "object-get") {
          const { bucket, key, previewBytes } = getInput.parse(input); const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...(previewBytes ? { Range: `bytes=0-${previewBytes - 1}` } : {}) }), { abortSignal: context.signal });
          const metadata = { key, size: result.ContentLength, contentType: result.ContentType, updatedAt: result.LastModified?.toISOString(), etag: result.ETag };
          if (!previewBytes) return { ...metadata, streaming: true, body: result.Body };
          const bytes = result.Body ? await result.Body.transformToByteArray() : new Uint8Array();
          return { ...metadata, preview: Buffer.from(bytes).toString("base64"), encoding: "base64", truncated: result.ContentRange ? !result.ContentRange.endsWith(`/${bytes.length}`) : false };
        }
        throw new Error(`Unsupported S3 operation: ${operationId}`);
      },
      async close() { client.destroy(); },
    };
  },
});
export default s3Adapter;
