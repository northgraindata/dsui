/**
 * Builds a plugin from source, the same way an adapter is built.
 *
 * A plugin used to be a package name and a bundle somebody had written by
 * hand. That made a plugin with a browser component impossible to produce
 * safely: there was no step that installed its dependencies, and no step that
 * produced `components.mjs`, so the only way to ship a custom component was to
 * hand-write the browser module. This module is that missing step, reusing the
 * adapter pipeline rather than a second implementation of it.
 *
 * Server and browser bundles are separate artifacts: a plugin's server entry
 * runs in Bun, its browser entry runs in the page and cannot contain native
 * modules, so the two are built for different targets and neither is derived
 * from the other.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertBrowserBundleCovers } from "../adapters/browser-coverage.js";
import {
  _SHA,
  bundleWithExtras,
  copyTree,
  defaultRun,
  extractTar,
  gunzip,
  MAX_ARCHIVE_BYTES,
  readResponseBytes,
  repository,
  rewriteWorkspaceDependencies,
  serverEntry,
  writeTree,
} from "../adapters/build.js";
import type { AdapterFetch } from "../adapters/fetch.js";
import {
  assertSafeAdapterUrl,
  ExternalAdapterError,
} from "../adapters/fetch.js";

/** Injected for tests; defaults to the global fetch. */
export type PluginFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

/** Where a plugin's source comes from, mirroring an adapter's sources. */
export type PluginSourceLocation =
  | { kind: "local"; path: string }
  | {
      kind: "git";
      repository: string;
      /** A commit SHA, a tag, or a branch. */
      ref: string;
      /** Directory to build when the repository holds several packages. */
      path?: string;
    };

export type PluginBuildPhase = "fetch" | "install" | "bundle";

export interface PluginBuildOptions {
  /** Directory holding the prepared SDK packages the plugin links against. */
  sdkPackageRoot: string;
  /** Where build artifacts and sources are kept. */
  dataDir: string;
  fetch?: AdapterFetch;
  /** Reuse the previous build; never touches the network. */
  offline?: boolean;
  onPhase?: (phase: PluginBuildPhase) => void;
  run?: (command: string[], cwd: string) => Promise<void>;
}

export interface BuiltPlugin {
  /** Server bundle, loaded by the host. */
  bundlePath: string;
  /**
   * Browser bundle, present only when the package declares `dsui.browser`.
   * A plugin built entirely from builtin components does not need one.
   */
  browserBundlePath?: string;
  buildDir: string;
  /** The commit actually built, when the ref was a pinned SHA. */
  commit?: string;
}

/** The manifest fields the build reads. */
interface PluginManifest {
  name?: string;
  exports?: Record<string, unknown> | string;
  main?: string;
  dsui?: { browser?: string };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * A plugin's server entry, with a plugin-specific fallback.
 *
 * A plugin publishes a default export, so a package that names neither
 * `exports` nor `main` gets the conventional `src/plugin.ts` rather than the
 * adapter's `src/adapter.ts`.
 */
function pluginServerEntry(manifest: PluginManifest): string {
  if (manifest.main) return serverEntry(manifest);
  if (manifest.exports) return serverEntry(manifest);
  return "src/plugin.ts";
}

export async function buildPlugin(
  id: string,
  location: PluginSourceLocation,
  options: PluginBuildOptions,
): Promise<BuiltPlugin> {
  if (!/^[a-z][a-z0-9-]*$/.test(id))
    throw new ExternalAdapterError("Invalid plugin id");
  const buildDir = join(options.dataDir, "plugins", "build", id);
  const sourceDir = join(buildDir, "src");
  const bundlePath = join(sourceDir, "dist", "plugin.mjs");
  const browserBundlePath = join(sourceDir, "dist", "components.mjs");
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
    const rootPrefix = `${location.repository.split("/")[1]}-`;
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
      "Plugin source",
    );
    const files = extractTar(await gunzip(archive), rootPrefix);
    await writeTree(sourceDir, files, location.path);
    commit = _SHA.test(location.ref) ? location.ref : undefined;
  }

  const manifestPath = join(sourceDir, "package.json");
  let manifest: PluginManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new ExternalAdapterError(
      "Plugin source has no readable package.json",
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
    { entry: pluginServerEntry(manifest), outfile: bundlePath, target: "bun" },
    [],
  );
  await readFile(bundlePath);

  // A browser bundle is optional. A plugin that composes builtin components
  // never declares one and needs no React in the page.
  if (manifest.dsui?.browser) {
    await bundleWithExtras(
      run,
      sourceDir,
      {
        entry: manifest.dsui.browser.replace(/^\.\//, ""),
        outfile: browserBundlePath,
        target: "browser",
      },
      [
        "*.css",
        ...(manifest.optionalDependencies
          ? Object.keys(manifest.optionalDependencies)
          : []),
      ],
    );
    await readFile(browserBundlePath);
    // A component declared with a `path` renders through this bundle, so a
    // missing export is a blank page in production. Fail the build instead.
    await assertBrowserBundleCovers({
      packageRoot: sourceDir,
      browserBundlePath,
      packageName: String(manifest.name ?? id),
    });
  }

  return {
    bundlePath,
    ...(manifest.dsui?.browser ? { browserBundlePath } : {}),
    buildDir,
    ...(commit ? { commit } : {}),
  };
}
