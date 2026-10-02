/**
 * Adapter build pipeline.
 *
 * Every adapter reaches the host the same way: source is materialized into an
 * isolated directory, dependencies are installed, and the entrypoint is bundled
 * into one self-contained ESM file that `adapter-host` executes in a
 * subprocess. There is no separate path for adapters that ship with DSUI; a
 * bundled adapter and a third-party adapter differ only in where their source
 * comes from.
 *
 * This is the trade-off of that design, stated plainly: building an adapter
 * runs a package manager and a bundler over code DSUI did not write. Lifecycle
 * scripts are disabled (`--ignore-scripts`) and downloads are restricted to
 * allowlisted HTTPS hosts, but the subprocess remains unsandboxed. Callers that
 * need an isolation boundary must supply one at the OS or container level.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertBrowserBundleCovers,
  type ComponentDeclaration as DeclaredComponent,
  declaredPackageComponents,
} from "./browser-coverage.js";
import {
  type AdapterFetch,
  assertSafeAdapterUrl,
  ExternalAdapterError,
} from "./fetch.js";

/** Where an adapter's source lives, independent of how it is obtained. */
export type AdapterSourceLocation =
  | {
      /** Read this directory from disk as the adapter source. */
      readonly kind: "local";
      /** Absolute or cwd-relative directory containing the adapter package. */
      readonly path: string;
    }
  | {
      /** Fetch a subdirectory of a GitHub repository. */
      readonly kind: "git";
      /** `owner/repo`. */
      readonly repository: string;
      /** Branch, tag, or commit. Floating refs are resolved per build. */
      readonly ref: string;
      /** Directory within the repository holding the adapter package. */
      readonly subdirectory?: string;
    };

/** Reported as a build progresses, so a caller can show what it is waiting for. */
export type AdapterBuildPhase = "fetch" | "install" | "bundle";

export interface AdapterBuildOptions {
  /** Root for materialized sources and installs. */
  dataDir: string;
  /** Root of the prepared SDK tree holding `node_modules/@northgraindata/*`. */
  sdkPackageRoot: string;
  fetch?: AdapterFetch;
  /** Reuse a stored bundle instead of rebuilding; never opens the network. */
  offline?: boolean;
  /** Injected for tests; defaults to the running bun executable. */
  run?: (command: string[], cwd: string) => Promise<void>;
  /** Called as the build moves between phases. */
  onPhase?: (phase: AdapterBuildPhase) => void;
}

export interface BuiltAdapter {
  /** Self-contained ESM bundle executed by `adapter-host`. */
  bundlePath: string;
  /**
   * Browser bundle serving the adapter's custom components, when the package
   * declares one. Absent for adapters built entirely from builtin components.
   */
  browserBundlePath?: string;
  /** Custom components the package declares, for the adapter catalog. */
  components?: { id: string; path: string }[];
  /** Isolated directory holding the materialized source and node_modules. */
  buildDir: string;
  /** Commit the source was fetched from, when built from git. */
  commit?: string;
}

export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 64 * 1024 * 1024;
export const _SHA = /^[a-f0-9]{40}$/;
export const repository = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const safeSegment = /^[A-Za-z0-9._-]+$/;

/**
 * Rejects any path that could escape the extraction root. Segments are
 * validated individually so `..` cannot survive normalization.
 */
export function assertSafeRelativePath(path: string): string {
  const segments = path.split("/");
  for (const segment of segments) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      !safeSegment.test(segment)
    )
      throw new ExternalAdapterError(
        "Adapter source contains an unsafe path segment",
      );
  }
  return segments.join("/");
}

function tarString(block: Uint8Array, start: number, length: number): string {
  const bytes = block.slice(start, start + length);
  const nul = bytes.indexOf(0);
  return new TextDecoder().decode(nul === -1 ? bytes : bytes.slice(0, nul));
}

function tarNumber(block: Uint8Array, start: number, length: number): number {
  const raw = tarString(block, start, length).trim();
  if (!/^[0-7]*$/.test(raw))
    throw new ExternalAdapterError("Invalid tar archive size");
  return raw ? Number.parseInt(raw, 8) : 0;
}

/** Minimal tar reader. Regular files and directories only; no links. */
export function extractTar(
  archive: Uint8Array,
  repository: string,
): Map<string, Uint8Array> {
  const [owner, name] = repository.split("/");
  if (!owner || !name)
    throw new ExternalAdapterError("Invalid GitHub repository");
  const rootPrefixes = [`${name}-`, `${owner}-${name}-`];
  if (archive.length > MAX_ARCHIVE_BYTES)
    throw new ExternalAdapterError("Adapter source archive exceeds size limit");
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  let total = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.slice(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const prefix = tarString(header, 345, 155);
    const name = `${prefix ? `${prefix}/` : ""}${tarString(header, 0, 100)}`;
    const type = String.fromCharCode(header[156] || 48);
    const size = tarNumber(header, 124, 12);
    const dataStart = offset + 512;
    const padded = Math.ceil(size / 512) * 512;
    if (dataStart + padded > archive.length)
      throw new ExternalAdapterError("Truncated adapter source archive");
    offset = dataStart + padded;
    if (type !== "0" && type !== "\0" && type !== "5") continue;
    const normalized = name.replace(/\/+$/, "");
    const separator = normalized.indexOf("/");
    if (separator === -1) continue;
    const archiveRoot = normalized.slice(0, separator);
    if (!rootPrefixes.some((prefix) => archiveRoot.startsWith(prefix)))
      continue;
    if (type === "5") continue;
    const relative = normalized.slice(separator + 1);
    if (!relative) continue;
    assertSafeRelativePath(relative);
    total += size;
    if (total > MAX_UNPACKED_BYTES)
      throw new ExternalAdapterError(
        "Adapter source expands beyond size limit",
      );
    if (files.has(relative))
      throw new ExternalAdapterError(
        "Adapter source contains a duplicate file",
      );
    files.set(relative, archive.slice(dataStart, dataStart + size));
  }
  return files;
}

export async function readResponseBytes(
  response: Response,
  limit: number,
  label: string,
): Promise<Uint8Array> {
  if (!response.ok || !response.body)
    throw new ExternalAdapterError(
      `${label} download failed (${response.status})`,
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > limit)
        throw new ExternalAdapterError(`${label} exceeds size limit`);
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([new Uint8Array(bytes)])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new ExternalAdapterError(
      "Adapter source archive is not a valid gzip tarball",
      error,
    );
  }
}

export async function writeTree(
  root: string,
  files: Map<string, Uint8Array>,
  subdirectory?: string,
): Promise<void> {
  const prefix = subdirectory
    ? `${assertSafeRelativePath(subdirectory)}/`
    : undefined;
  let written = 0;
  for (const [relative, bytes] of files) {
    if (prefix && !relative.startsWith(prefix)) continue;
    const target = join(
      root,
      prefix ? relative.slice(prefix.length) : relative,
    );
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, bytes);
    written += 1;
  }
  if (!written)
    throw new ExternalAdapterError(
      subdirectory
        ? `Source archive has no package in "${subdirectory}"`
        : "Source archive contains no files",
    );
}

/**
 * Default command runner: the bun executable running DSUI itself.
 *
 * Output is captured on the thrown error rather than echoed, because the
 * bundler reports unresolvable native specifiers only on stderr and
 * `bundleWithExtras` acts on them. Echoing as it arrives would interleave
 * build chatter with the caller's own progress output.
 */
export const defaultRun = async (
  command: string[],
  cwd: string,
): Promise<void> => {
  const child = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  // Build chatter is only interesting once something has already gone wrong,
  // and it is captured on the thrown error below. Forwarding it as it arrives
  // would interleave with the CLI's progress line, so it is held back until
  // the run fails and then appears as the reason.
  if (code !== 0)
    throw new ExternalAdapterError(
      `${command.join(" ")} failed with exit code ${code}\n${[stderr, stdout]
        .filter(Boolean)
        .join("\n")}`,
    );
};

/** Copies a directory tree, skipping build output and dotfiles. */
export async function copyTree(from: string, to: string): Promise<void> {
  const entries = await readdir(from, { withFileTypes: true });
  await mkdir(to, { recursive: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const childSource = join(from, entry.name);
    const childTarget = join(to, entry.name);
    if (entry.isDirectory()) await copyTree(childSource, childTarget);
    else if (entry.isFile())
      await writeFile(childTarget, await readFile(childSource));
    else
      throw new ExternalAdapterError(
        `Adapter source contains an unsupported entry: ${entry.name}`,
      );
  }
}

interface AdapterManifest {
  name?: string;
  /** Entry DSUI bundles for the server, relative to the package root. */
  exports?: Record<string, unknown> | string;
  main?: string;
  dsui?: {
    /** Entry DSUI bundles for the browser, relative to the package root. */
    browser?: string;
  };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * The package's server entry: `exports["."]` when declared, else `main`, else
 * the conventional `src/adapter.ts`. Read from the manifest rather than
 * hardcoded so a package can name its entry freely.
 */
export function serverEntry(manifest: AdapterManifest): string {
  const declared =
    typeof manifest.exports === "string"
      ? manifest.exports
      : typeof manifest.exports?.["."] === "string"
        ? (manifest.exports["."] as string)
        : undefined;
  const entry = declared ?? manifest.main ?? "./src/adapter.ts";
  if (!/^\.?\.?\/[A-Za-z0-9._/-]+\.tsx?$/.test(entry))
    throw new ExternalAdapterError(
      `Adapter entry must be a TypeScript file, found "${entry}"`,
    );
  return entry.replace(/^\.\//, "");
}

/**
 * Derives the package name from a specifier that failed to resolve,
 * e.g. `@duckdb/node-bindings-darwin-arm64/duckdb.node` to
 * `@duckdb/node-bindings-darwin-arm64`.
 */
function packageOf(specifier: string): string | undefined {
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) return parts.slice(0, 2).join("/");
  return parts[0] || undefined;
}

/** One resolution failure reported by the bundler. */
const UNRESOLVED = /Could not resolve:\s*"([^"]+)"/g;
/** The import site the bundler blamed, e.g. `.../node_modules/pkg/lib/a.js`. */
const AT_SITE = /at\s+(.+?node_modules\/((?:@[^/]+\/)?[^/]+)\/)/g;

/**
 * Builds the bundle, treating unresolvable native specifiers as external.
 *
 * Native packages resolve a platform-specific binary through conditional
 * `require` calls that the bundler cannot follow, and would otherwise demand a
 * binary for every platform at build time. Rather than hardcode a list of such
 * packages in DSUI, each failure is attributed to the package containing the
 * offending import and added to `--external`, then the build is retried. This
 * converges for duckdb, sharp, esbuild and anything else that ships a native
 * binary, without DSUI naming any of them.
 */
export async function bundleWithExtras(
  run: (command: string[], cwd: string) => Promise<void>,
  sourceDir: string,
  options: {
    entry: string;
    outfile: string;
    target: "bun" | "browser";
  },
  /**
   * Specifiers excluded from the bundle, grown with anything the bundler could
   * not resolve. A browser target starts with the exclusions it can never
   * inline; a server target starts empty and grows by retry.
   */
  external: string[],
  maxAttempts = 12,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await run(
        [
          "bun",
          "build",
          options.entry,
          "--bundle",
          "--target",
          options.target,
          "--format",
          "esm",
          ...external.flatMap((item) => ["--external", item]),
          "--outfile",
          options.outfile,
        ],
        sourceDir,
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const discovered = new Set<string>();
      for (const match of message.matchAll(UNRESOLVED)) {
        const name = packageOf(match[1]);
        // Only bare specifiers can become an `--external` entry; a relative
        // import is a genuine error the author has to fix.
        if (name && !name.startsWith(".") && !name.startsWith("/"))
          discovered.add(name);
      }
      // Prefer the importing package: leaving `@duckdb/node-bindings` external
      // retires every platform branch it contains, while externing only the
      // platform packages one at a time never converges.
      for (const match of message.matchAll(AT_SITE)) discovered.add(match[2]);
      const next = [...discovered].filter((item) => !external.includes(item));
      if (!next.length) throw error;
      external.push(...next);
    }
  }
  throw new ExternalAdapterError(
    "Adapter bundle could not be resolved after repeated externalization",
  );
}

/**
 * Rewrites workspace and file protocol ranges onto the SDK that ships with this
 * DSUI install, so an adapter authored inside a monorepo resolves the same SDK
 * the host was built against instead of failing on `workspace:*`.
 */
export function rewriteWorkspaceDependencies(
  manifest: AdapterManifest,
  preparedRoot: string,
): AdapterManifest {
  const rewritten: AdapterManifest = { ...manifest };
  const rewrite = (deps?: Record<string, string>) => {
    if (!deps) return undefined;
    const next: Record<string, string> = {};
    for (const [name, range] of Object.entries(deps)) {
      if (!range.startsWith("workspace:") && !range.startsWith("file:")) {
        next[name] = range;
        continue;
      }
      // Every workspace package resolves to the copy inside the prepared SDK
      // tree, not to this one. Mapping them all onto `sdkPackagePath` would
      // point `@northgraindata/dsui-ui` at the adapter SDK.
      const prepared = join(preparedRoot, "node_modules", ...name.split("/"));
      next[name] = `file:${prepared}`;
    }
    return next;
  };
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "devDependencies",
  ] as const) {
    const next = rewrite(manifest[field]);
    if (next) rewritten[field] = next;
  }
  return rewritten;
}

/**
 * Builds one adapter from source and returns its executable bundle.
 *
 * The source is materialized fresh on every call, so a floating ref is picked
 * up on the next start. Pass `offline` to reuse a previously built bundle
 * without opening the network.
 */
export async function buildAdapter(
  id: string,
  location: AdapterSourceLocation,
  options: AdapterBuildOptions,
): Promise<BuiltAdapter> {
  if (!/^[a-z][a-z0-9-]*$/.test(id))
    throw new ExternalAdapterError("Invalid adapter id");
  const buildDir = join(options.dataDir, "adapters", "build", id);
  const sourceDir = join(buildDir, "src");
  // Inside the source tree so an external dependency resolves through the
  // `node_modules` installed beside it when `adapter-host` runs the bundle.
  const bundlePath = join(sourceDir, "dist", "adapter.mjs");
  if (options.offline) {
    await readFile(bundlePath);
    return { bundlePath, buildDir };
  }

  options.onPhase?.("fetch");
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(sourceDir, { recursive: true });

  let commit: string | undefined;
  if (location.kind === "local") {
    await copyTree(location.path, sourceDir);
  } else {
    if (!repository.test(location.repository))
      throw new ExternalAdapterError("Invalid GitHub repository");
    const url = assertSafeAdapterUrl(
      `https://codeload.github.com/${location.repository}/tar.gz/${encodeURIComponent(location.ref)}`,
    );
    const response = await (options.fetch ?? fetch)(url.toString(), {
      redirect: "error",
      headers: { accept: "application/octet-stream" },
    });
    const archive = await readResponseBytes(
      response,
      MAX_ARCHIVE_BYTES,
      "Adapter source",
    );
    const files = extractTar(await gunzip(archive), location.repository);
    await writeTree(sourceDir, files, location.subdirectory);
    // A pinned commit is recorded verbatim; a floating ref resolves to the
    // archive actually fetched, which is what the build consumed.
    commit = _SHA.test(location.ref) ? location.ref : undefined;
  }

  const manifestPath = join(sourceDir, "package.json");
  let manifest: AdapterManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new ExternalAdapterError(
      "Adapter source has no readable package.json",
    );
  }
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      rewriteWorkspaceDependencies(manifest, options.sdkPackageRoot),
      null,
      2,
    )}\n`,
    "utf8",
  );

  const run = options.run ?? defaultRun;
  options.onPhase?.("install");
  await run(["bun", "install", "--ignore-scripts", "--no-save"], sourceDir);
  options.onPhase?.("bundle");
  await bundleWithExtras(
    run,
    sourceDir,
    { entry: serverEntry(manifest), outfile: bundlePath, target: "bun" },
    [],
  );
  await readFile(bundlePath);

  // A browser bundle is optional: an adapter composed entirely of builtin
  // components never declares one, and needs no React in the browser.
  let browserBundlePath: string | undefined;
  if (manifest.dsui?.browser) {
    browserBundlePath = join(sourceDir, "dist", "components.mjs");
    await bundleWithExtras(
      run,
      sourceDir,
      {
        entry: manifest.dsui.browser.replace(/^\.\//, ""),
        outfile: browserBundlePath,
        target: "browser",
      },
      // A stylesheet is not a module, and the web build already ships adapter
      // CSS through the renderer's stylesheet, so it cannot be inlined here.
      // Native packages cannot target a browser at all.
      [
        "*.css",
        ...(manifest.optionalDependencies
          ? Object.keys(manifest.optionalDependencies)
          : []),
      ],
    );
    await readFile(browserBundlePath);
    // A component declared with a `path` renders through this bundle, so a gap
    // here is a silent blank page. Fail the build instead.
    await assertBrowserBundleCovers({
      packageRoot: sourceDir,
      browserBundlePath,
      packageName: String(manifest.name ?? id),
    });
  }
  // The catalog lists what the package declares; the paths are what the old
  // manifest carried, and the renderer only needs the id to resolve one.
  const declarations: DeclaredComponent[] = await declaredPackageComponents({
    packageRoot: sourceDir,
  });
  const components = declarations.map(({ id, path }) => ({ id, path }));
  return {
    bundlePath,
    ...(browserBundlePath ? { browserBundlePath } : {}),
    ...(components.length ? { components } : {}),
    buildDir,
    ...(commit ? { commit } : {}),
  };
}
