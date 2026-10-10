import type { Dirent } from "node:fs";
import { cp, lstat, readdir, readlink, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Recursively replaces symlinks under `root` with physical copies of their
 * targets. npm 11 exits with "Exit handler never called!" on Linux when
 * packing a directory that contains symlinks, so the published npm package
 * must be a plain tree. Relative links are resolved against their own
 * location; a linked directory is copied with dereferencing, a linked file is
 * copied verbatim.
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
