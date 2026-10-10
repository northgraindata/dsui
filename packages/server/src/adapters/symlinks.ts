import type { Dirent } from "node:fs";
import {
  chmod,
  copyFile,
  cp,
  lstat,
  mkdtemp,
  readdir,
  readlink,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Recursively replaces symlinks under `root` with physical copies of their
 * targets so SDK dependencies are shipped as regular files. Relative links
 * are resolved against their own location; directories are copied with
 * dereferencing and files are copied verbatim.
 */
export async function materializeSymlinks(root: string): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const path = join(root, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) {
      const target = await readlink(path);
      const resolved = target.startsWith("/") ? target : join(root, target);
      const resolvedInfo = await lstat(resolved).catch(() => null);
      if (resolvedInfo?.isDirectory()) {
        await rm(path, { recursive: true, force: true });
        await cp(resolved, path, { recursive: true, dereference: true });
      } else {
        await rm(path, { force: true });
        await cp(resolved, path, { dereference: true });
      }
    } else if (info.isDirectory()) {
      await materializeSymlinks(path);
    }
  }
}

/** Detach Bun's hardlinked dependencies from their cache before npm packs them. */
export async function materializeHardlinks(root: string): Promise<void> {
  // Keep the replacement on the same filesystem so rename remains atomic.
  const temporary = await mkdtemp(join(dirname(root), ".dsui-hardlinks-"));
  const replacement = join(temporary, "file");
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const info = await lstat(path);
      if (info.isDirectory()) {
        await visit(path);
      } else if (info.isFile() && info.nlink > 1) {
        await copyFile(path, replacement);
        await chmod(replacement, info.mode);
        await rename(replacement, path);
      }
    }
  }
  try {
    await visit(root);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
