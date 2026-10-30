import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  assertBlobKey,
  type BlobInfo,
  type BlobStore,
} from "@northgraindata/dsui-adapter-sdk";

/** Holds in-flight writes. Key segments cannot start with a dot, so no key lands here. */
const TEMP_DIRECTORY = ".tmp";

/**
 * Where one service keeps its blobs.
 *
 * The directory name is derived from the service id but never contains it
 * verbatim, so an id with separators or dots cannot leave the blob root.
 */
export function blobDirectory(root: string, namespace: string): string {
  const readable = namespace.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40);
  const digest = createHash("sha256").update(namespace).digest("hex");
  return join(root, `${readable}-${digest.slice(0, 12)}`);
}

const missing = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";

/** Blob storage backed by a directory, written atomically through rename. */
export class FileBlobStore implements BlobStore {
  constructor(private readonly directory: string) {}

  private pathOf(key: string): string {
    assertBlobKey(key);
    return join(this.directory, ...key.split("/"));
  }

  private async info(key: string, path: string): Promise<BlobInfo | null> {
    try {
      const file = await stat(path);
      if (!file.isFile()) return null;
      return { key, size: file.size, updatedAt: file.mtime.toISOString() };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathOf(key)));
    } catch (error) {
      if (missing(error)) return null;
      // A key that is a directory prefix of other keys is not a blob.
      if ((error as NodeJS.ErrnoException).code === "EISDIR") return null;
      throw error;
    }
  }

  async put(key: string, data: Uint8Array | string): Promise<BlobInfo> {
    const path = this.pathOf(key);
    const temporary = join(
      this.directory,
      TEMP_DIRECTORY,
      `${randomUUID()}.part`,
    );
    await mkdir(dirname(temporary), { recursive: true });
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, data);
    try {
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    const info = await this.info(key, path);
    if (!info) throw new Error(`Blob "${key}" vanished after it was written`);
    return info;
  }

  stat(key: string): Promise<BlobInfo | null> {
    return this.info(key, this.pathOf(key));
  }

  async list(prefix = ""): Promise<readonly BlobInfo[]> {
    const found: BlobInfo[] = [];
    const visit = async (directory: string, base: string) => {
      let entries: import("node:fs").Dirent[];
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (missing(error)) return;
        throw error;
      }
      for (const entry of entries) {
        if (base === "" && entry.name === TEMP_DIRECTORY) continue;
        const key = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await visit(join(directory, entry.name), key);
        else if (entry.isFile() && key.startsWith(prefix)) {
          const info = await this.info(key, join(directory, entry.name));
          if (info) found.push(info);
        }
      }
    };
    await visit(this.directory, "");
    return found.sort((left, right) => (left.key < right.key ? -1 : 1));
  }

  async delete(key: string): Promise<boolean> {
    const path = this.pathOf(key);
    if (!(await this.info(key, path))) return false;
    await rm(path);
    return true;
  }
}

/** Removes every blob of a service, e.g. when the service is deleted. */
export async function removeServiceBlobs(
  root: string,
  namespace: string,
): Promise<void> {
  await rm(blobDirectory(root, namespace), { recursive: true, force: true });
}
