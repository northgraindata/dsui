import { InvalidDefinitionError } from "./shared/errors";

/** Metadata of one stored blob. */
export interface BlobInfo {
  readonly key: string;
  /** Size in bytes. */
  readonly size: number;
  /** ISO timestamp of the last write. */
  readonly updatedAt: string;
}

/**
 * Binary storage private to one configured service.
 *
 * Stores hold small JSON state. A blob is for data too large or too opaque
 * for that, such as an artifact a pipeline uploaded. Keys are `/`-separated
 * paths (`runs/42/manifest.json`); the host decides where the bytes live.
 */
export interface BlobStore {
  /** The blob's bytes, or `null` when the key does not exist. */
  get(key: string): Promise<Uint8Array | null>;
  /** Writes atomically: a reader sees the old bytes or the new, never a mix. */
  put(key: string, data: Uint8Array | string): Promise<BlobInfo>;
  stat(key: string): Promise<BlobInfo | null>;
  /** Blobs whose key starts with `prefix`, ordered by key. */
  list(prefix?: string): Promise<readonly BlobInfo[]>;
  /** Removes a blob; `false` when it did not exist. */
  delete(key: string): Promise<boolean>;
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_KEY_LENGTH = 256;

/**
 * Rejects keys that could address anything but a blob: empty or dotted
 * segments, absolute paths and characters outside a conservative set.
 * Hosts must call this before touching a filesystem.
 */
export function assertBlobKey(key: string): void {
  if (key.length === 0 || key.length > MAX_KEY_LENGTH)
    throw new InvalidDefinitionError(
      `Blob key must be 1-${MAX_KEY_LENGTH} characters`,
    );
  for (const segment of key.split("/"))
    if (!SEGMENT.test(segment) || segment.includes(".."))
      throw new InvalidDefinitionError(`Invalid blob key: ${key}`);
}

/** Blob storage that lives and dies with the process. Used in tests and as the default. */
export function createMemoryBlobStore(): BlobStore {
  const blobs = new Map<string, { bytes: Uint8Array; updatedAt: string }>();
  const info = (
    key: string,
    bytes: Uint8Array,
    updatedAt: string,
  ): BlobInfo => ({
    key,
    size: bytes.byteLength,
    updatedAt,
  });
  return {
    async get(key) {
      assertBlobKey(key);
      const blob = blobs.get(key);
      return blob ? new Uint8Array(blob.bytes) : null;
    },
    async put(key, data) {
      assertBlobKey(key);
      const bytes =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);
      const updatedAt = new Date().toISOString();
      blobs.set(key, { bytes, updatedAt });
      return info(key, bytes, updatedAt);
    },
    async stat(key) {
      assertBlobKey(key);
      const blob = blobs.get(key);
      return blob ? info(key, blob.bytes, blob.updatedAt) : null;
    },
    async list(prefix = "") {
      return [...blobs.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .map(([key, blob]) => info(key, blob.bytes, blob.updatedAt));
    },
    async delete(key) {
      assertBlobKey(key);
      return blobs.delete(key);
    },
  };
}
