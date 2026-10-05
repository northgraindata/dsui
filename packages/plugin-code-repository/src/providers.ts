import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { PluginRequestError, z } from "@northgraindata/dsui-plugin-sdk";
import { unzipSync } from "fflate";
import type { Config, Connection, SnapshotFile } from "./model";

import { ignored, safePath } from "./paths";

function inside(root: string, path: string) {
  const difference = relative(root, path);
  return (
    difference === "" ||
    (difference !== ".." &&
      !difference.startsWith(`..${sep}`) &&
      !isAbsolute(difference))
  );
}
export async function localDirectory(
  config: Config,
  item: Pick<Connection, "repository" | "folder">,
) {
  const requested = resolve(item.repository, safePath(item.folder));
  let directory: string;
  try {
    const repositoryRoot = await realpath(resolve(item.repository));
    directory = await realpath(requested);
    if (!inside(repositoryRoot, directory))
      throw new PluginRequestError(
        "Subfolder escaped the selected local source",
      );
  } catch (error) {
    if (error instanceof PluginRequestError) throw error;
    throw new PluginRequestError(
      "Local folder does not exist or cannot be read",
    );
  }
  const roots = await Promise.all(
    config.localRoots.map((root) => realpath(resolve(root))),
  );
  if (!roots.some((root) => inside(root, directory)))
    throw new PluginRequestError("Folder is outside configured localRoots");
  if (!(await stat(directory)).isDirectory())
    throw new PluginRequestError("Source is not a directory");
  return directory;
}
export async function localFolders(
  config: Config,
  repository: string,
  signal: AbortSignal,
) {
  const root = await localDirectory(config, { repository, folder: "" });
  const folders: string[] = [];
  const walk = async (directory: string, prefix: string): Promise<void> => {
    signal.throwIfAborted();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      folders.push(path);
      if (folders.length > config.maxFiles)
        throw new PluginRequestError(
          "Too many folders to list; enter a subfolder manually",
        );
      await walk(resolve(directory, entry.name), path);
    }
  };
  await walk(root, "");
  return folders.sort();
}

function remote(
  config: Config,
  item: Pick<Connection, "provider" | "instance" | "repository">,
) {
  if (item.provider === "github") {
    const repository = item.repository
      .replace(/^https:\/\/github\.com\//, "")
      .replace(/\.git$/, "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
      throw new PluginRequestError(
        "Use a GitHub repository as owner/repository",
      );
    return {
      base: `https://api.github.com/repos/${repository}`,
      token: config.githubToken,
      github: true,
    };
  }
  const instance = config.gitlab.find((entry) => entry.id === item.instance);
  if (!instance) throw new PluginRequestError("Unknown GitLab instance");
  const origin = new URL(instance.url);
  if (origin.protocol !== "https:" || origin.username || origin.password)
    throw new PluginRequestError("GitLab URL must use HTTPS");
  const repository = item.repository
    .replace(`${instance.url.replace(/\/$/, "")}/`, "")
    .replace(/\.git$/, "");
  if (!repository || /[?#]/.test(repository))
    throw new PluginRequestError("Invalid GitLab project");
  return {
    base: `${instance.url.replace(/\/$/, "")}/api/v4/projects/${encodeURIComponent(repository)}`,
    token: instance.token,
    github: false,
  };
}
async function request(
  url: string,
  source: ReturnType<typeof remote>,
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(url, {
    signal,
    redirect: "manual",
    headers: {
      ...(source.token
        ? {
            [source.github ? "Authorization" : "PRIVATE-TOKEN"]: source.github
              ? `Bearer ${source.token}`
              : source.token,
          }
        : {}),
      ...(source.github ? { Accept: "application/vnd.github+json" } : {}),
    },
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const target = new URL(response.headers.get("location") ?? "", url);
    if (
      !source.github ||
      target.protocol !== "https:" ||
      target.hostname !== "codeload.github.com"
    )
      throw new PluginRequestError("Unexpected repository redirect");
    const download = await fetch(target, { signal, redirect: "error" });
    if (!download.ok)
      throw new Error(`Repository download failed (${download.status})`);
    return download;
  }
  if (!response.ok) {
    const message = `Repository request failed (${response.status}); check repository and token permissions`;
    if (response.status === 429 || response.status >= 500)
      throw new Error(message);
    throw new PluginRequestError(message);
  }
  return response;
}
const branchesSchema = z.array(z.object({ name: z.string() }));
export async function branches(
  config: Config,
  item: Pick<Connection, "provider" | "instance" | "repository">,
  signal: AbortSignal,
): Promise<string[]> {
  const source = remote(config, item);
  const names: string[] = [];
  for (let page = 1; page <= 100; page++) {
    const url = `${source.base}/${source.github ? "branches" : "repository/branches"}?per_page=100&page=${page}`;
    const results = branchesSchema.parse(
      await (await request(url, source, signal)).json(),
    );
    names.push(...results.map((branch) => branch.name));
    if (results.length < 100) return names;
  }
  throw new Error("Repository has too many branches");
}
async function limitedBytes(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.body) throw new Error("Empty repository archive");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes)
        throw new PluginRequestError(
          "Repository archive exceeds snapshot size limit",
        );
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function archiveFiles(
  bytes: Uint8Array,
  config: Config,
  folder: string,
): SnapshotFile[] {
  const prefix = safePath(folder);
  let total = 0;
  let count = 0;
  const archive = unzipSync(bytes, {
    filter: (entry) => {
      if (entry.name.endsWith("/")) return false;
      const path = safePath(entry.name.split("/").slice(1).join("/"));
      if (!path || path.split("/").some((segment) => ignored.has(segment)))
        return false;
      if (prefix && !path.startsWith(`${prefix}/`)) return false;
      total += entry.originalSize;
      if (total > config.maxSnapshotBytes || ++count > config.maxFiles)
        throw new PluginRequestError("Repository exceeds snapshot limits");
      return true;
    },
  });
  const files: SnapshotFile[] = [];
  for (const [name, content] of Object.entries(archive)) {
    const path = safePath(name.split("/").slice(1).join("/"));
    if (!path || path.split("/").some((segment) => ignored.has(segment)))
      continue;
    if (prefix && !path.startsWith(`${prefix}/`)) continue;
    files.push({
      path: prefix ? path.slice(prefix.length + 1) : path,
      bytes: content,
      size: content.length,
    });
  }
  if (prefix && !files.length)
    throw new PluginRequestError(
      "Selected repository folder is missing or empty",
    );
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function fetchSnapshot(
  config: Config,
  item: Connection,
  signal: AbortSignal,
): Promise<{ version: string; files: SnapshotFile[] }> {
  if (item.provider === "local") {
    const root = await localDirectory(config, item);
    const files: SnapshotFile[] = [];
    let total = 0;
    async function walk(directory: string) {
      signal.throwIfAborted();
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
        const path = resolve(directory, entry.name);
        if (!inside(root, await realpath(path)))
          throw new Error("Local file escaped source folder");
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile()) {
          const handle = await open(
            path,
            constants.O_RDONLY | constants.O_NOFOLLOW,
          );
          try {
            const metadata = await handle.stat();
            total += metadata.size;
            if (
              total > config.maxSnapshotBytes ||
              files.length >= config.maxFiles
            )
              throw new PluginRequestError("Folder exceeds snapshot limits");
            const bytes = new Uint8Array(metadata.size);
            let offset = 0;
            while (offset < bytes.length) {
              signal.throwIfAborted();
              const { bytesRead } = await handle.read(
                bytes,
                offset,
                bytes.length - offset,
                offset,
              );
              if (!bytesRead)
                throw new Error("Local file changed during fetch; retrying");
              offset += bytesRead;
            }
            const after = await handle.stat();
            if (
              after.size !== metadata.size ||
              after.mtimeMs !== metadata.mtimeMs
            )
              throw new Error("Local file changed during fetch; retrying");
            files.push({
              path: safePath(relative(root, path)),
              bytes,
              size: bytes.length,
            });
          } finally {
            await handle.close();
          }
        }
      }
    }
    await walk(root);
    files.sort((a, b) => a.path.localeCompare(b.path));
    const hash = createHash("sha256");
    for (const file of files) {
      hash.update(file.path);
      hash.update("\0");
      hash.update(String(file.size));
      hash.update("\0");
      hash.update(file.bytes);
    }
    return { version: hash.digest("hex"), files };
  }
  const source = remote(config, item);
  const commitUrl = `${source.base}/${source.github ? "commits" : "repository/commits"}/${encodeURIComponent(item.branch)}`;
  const result = await (await request(commitUrl, source, signal)).json();
  const version = source.github
    ? z.object({ sha: z.string() }).parse(result).sha
    : z.object({ id: z.string() }).parse(result).id;
  if (!/^[a-f0-9]{40,64}$/.test(version))
    throw new Error("Invalid repository commit");
  if (version === item.version) return { version, files: [] };
  const archiveUrl = source.github
    ? `${source.base}/zipball/${version}`
    : `${source.base}/repository/archive.zip?sha=${version}&include_lfs_blobs=false`;
  const bytes = await limitedBytes(
    await request(archiveUrl, source, signal),
    config.maxSnapshotBytes,
  );
  return { version, files: archiveFiles(bytes, config, item.folder) };
}
