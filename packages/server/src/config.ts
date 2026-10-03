import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { AdapterSourceLocation } from "./adapters/build.js";
import type { AdapterPackageSource } from "./adapters/types.js";

const installedPluginSourceSchema = z
  .object({
    package: z.string().min(1),
    browserBundle: z.string().min(1).optional(),
    enabled: z.boolean().default(true),
    critical: z.boolean().optional(),
    config: z.record(z.unknown()).default({}),
  })
  .strict();
const localPluginSourceSchema = z
  .object({
    source: z.literal("local"),
    path: z.string().min(1),
    enabled: z.boolean().default(true),
    critical: z.boolean().optional(),
    config: z.record(z.unknown()).default({}),
  })
  .strict();
/**
 * A plugin built from a GitHub repository, the same shape an adapter uses.
 *
 * `commit` and `integrity` were required here because this source was fetched
 * as a prebuilt, hash-pinned bundle. A source-built plugin is compiled locally
 * from the tree, so a hash of the download would pin nothing useful, and
 * requiring one made the schema describe a verification no code performed. A
 * deployment that needs a pinned plugin points `ref` at a commit SHA.
 */
const gitPluginSourceSchema = z
  .object({
    source: z.literal("git"),
    repository: z.string().min(1),
    /** GitHub token for private repositories; normally interpolated from env. */
    token: z.string().min(1).optional(),
    /**
     * Branch, tag, or commit. Defaults to `main`.
     *
     * The ref is interpolated into a codeload URL, so it is restricted to the
     * characters a ref name can legitimately contain. Without this a ref could
     * add path segments or a query string to the download URL.
     */
    ref: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9._/-]+$/, "ref contains unsupported characters")
      .optional(),
    /** Directory within the repository holding the plugin package. */
    path: z.string().min(1).optional(),
    enabled: z.boolean().default(true),
    critical: z.boolean().optional(),
    config: z.record(z.unknown()).default({}),
  })
  .strict();
export const pluginSourceSchema = z.union([
  localPluginSourceSchema,
  installedPluginSourceSchema,
  gitPluginSourceSchema,
]);
export type PluginSource = z.infer<typeof pluginSourceSchema>;

const envToken = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

export class ConfigError extends Error {}

/**
 * Finds the configuration file, or null when it is not there.
 *
 * A relative `DSUI_CONFIG` is resolved against the working directory first and
 * then against every ancestor. `turbo run` starts each task with its cwd set to
 * the package, so `DSUI_CONFIG=./data/dsui.yaml` from the repository root would
 * otherwise look in `packages/server/data/`. An absolute path, which is what an
 * installed server gets, matches on the first try and never walks.
 */
async function locateConfig(path: string): Promise<string | null> {
  const candidates = [path];
  if (!isAbsolute(path)) {
    let directory = process.cwd();
    for (;;) {
      candidates.push(resolve(directory, path));
      const parent = dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

/** The subset of a Zod issue worth showing a person. */
interface Issue {
  readonly path: ReadonlyArray<PropertyKey>;
  readonly message: string;
}

/**
 * Translates a validated config entry into the location the builder reads.
 *
 * A local path is resolved against `cwd` here rather than inside the builder so
 * one directory cannot be resolved differently by two callers. A GitHub
 * `owner/repo` becomes the pair the builder passes to codeload, keeping the
 * repository spelling in exactly one place.
 */
export function toAdapterSourceLocation(
  source: AdapterSource,
  cwd: string,
): AdapterSourceLocation {
  if ("source" in source && source.source === "local") {
    return { kind: "local", path: resolve(cwd, source.path) };
  }
  if ("source" in source && source.source === "git") {
    const repository = source.repository
      .replace(/^git\+https:\/\/github\.com\//, "")
      .replace(/\.git$/, "");
    const [owner, name, ...rest] = repository.split("/");
    if (!owner || !name || rest.length) {
      throw new ConfigError(
        `adapter source must name a GitHub repository as owner/name, got "${source.repository}"`,
      );
    }
    return {
      kind: "git",
      repository: `${owner}/${name}`,
      // A pinned commit wins when given; otherwise the branch, tag, or default.
      ref: source.commit ?? source.ref ?? "main",
      ...(source.path ? { subdirectory: source.path } : {}),
    };
  }
  // A bare package name is not a source location: it names something to import,
  // not a tree to build. The loader handles that case.
  throw new ConfigError(
    "adapter source must be a local path, a package, or a GitHub repository",
  );
}

export function interpolateEnvironment(
  value: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return value.replace(envToken, (_token, name: string) => {
    const resolved = environment[name];
    if (resolved === undefined)
      throw new ConfigError(
        `Configuration requires environment variable ${name}`,
      );
    return resolved;
  });
}

function interpolate(value: unknown, environment: NodeJS.ProcessEnv): unknown {
  if (typeof value === "string")
    return interpolateEnvironment(value, environment);
  if (Array.isArray(value))
    return value.map((item) => interpolate(item, environment));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        interpolate(item, environment),
      ]),
    );
  return value;
}

const serviceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "service id must be kebab-case"),
  adapter: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  connection: z.record(z.unknown()).default({}),
});

/**
 * An adapter built from a directory on this machine.
 *
 * DSUI installs the package's dependencies and bundles it on start, so a
 * checkout runs without anything having been built first. `path` may be
 * absolute or relative to the working directory DSUI was started from.
 */
export const localAdapterSourceSchema = z
  .object({
    source: z.literal("local"),
    path: z.string().min(1),
  })
  .strict();
export type LocalAdapterSource = z.infer<typeof localAdapterSourceSchema>;

/**
 * An adapter package resolved by name and imported in-process.
 * Workspace packages and node_modules entries both work.
 */
export const packageAdapterSourceSchema = z
  .object({ package: z.string().min(1) })
  .strict();
export type PackageAdapterSource = z.infer<typeof packageAdapterSourceSchema>;

const exactVersion = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
    "must be an exact SemVer version",
  );

/**
 * A pinned npm adapter. Installed verified (tarball SRI + manifest
 * digest) and executed in an isolated adapter-host subprocess.
 */
export const npmAdapterSourceSchema = z
  .object({
    package: z.string().min(1),
    version: exactVersion,
    integrity: z
      .string()
      .regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/, "must be a SHA-512 SRI digest"),
    entry: z.string().min(1).optional(),
  })
  .strict();
export type NpmAdapterSource = z.infer<typeof npmAdapterSourceSchema>;

const gitRepository =
  /^git\+https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(?:\.git)?$/;
const commitSha = /^[a-f0-9]{40}$/;

/**
 * A pinned GitHub adapter source. The manifest and bundle are fetched
 * from `raw.githubusercontent.com` at the exact commit and verified by
 * SRI. Floating refs are deliberately unsupported.
 */
export const gitAdapterSourceSchema = z
  .object({
    source: z.literal("git"),
    repository: z
      .string()
      .regex(
        gitRepository,
        "must be a git+https://github.com/owner/repository URL",
      ),
    /**
     * Branch, tag, or commit to build from. Used when no `commit` is given.
     *
     * The ref is interpolated into the codeload URL, so it is restricted to the
     * characters a ref name can legitimately contain.
     */
    ref: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9._/-]+$/, "ref contains unsupported characters")
      .optional(),
    /** Directory within the repository holding the adapter package. */
    path: z.string().min(1).optional(),
    /**
     * Full commit SHA of a prebuilt artifact. Together with `integrity` this
     * selects the pinned-bundle path instead of building from source.
     */
    commit: z
      .string()
      .regex(commitSha, "must be a full 40-character commit SHA")
      .optional(),
    integrity: z
      .string()
      .regex(
        /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/,
        "must be an SRI digest",
      )
      .optional(),
    entry: z
      .string()
      .regex(/^\.\/dist\/[A-Za-z0-9._/-]+\.mjs$/)
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.commit) !== Boolean(value.integrity), {
    message:
      "commit and integrity are both required for a pinned prebuilt adapter, or both omitted to build from source",
  });
export type GitAdapterSource = z.infer<typeof gitAdapterSourceSchema>;

/** Per-adapter presentation overrides keyed by adapter id. */
export const adapterOverrideSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().min(1).max(400).optional(),
    iconUrl: z.string().url().optional(),
  })
  .strict();
export type AdapterOverride = z.infer<typeof adapterOverrideSchema>;

/**
 * An `adapters:` entry is either a package source (local, pinned npm,
 * or pinned git) or a presentation override for an already-registered
 * adapter, e.g.:
 *
 * adapters:
 *   example-service:
 *     package: "@acme/dsui-adapter-example"
 *   acme-thing:
 *     package: "@acme/dsui-adapter-thing"
 *     version: "1.2.3"
 *     integrity: "sha512-..."
 *   acme-git:
 *     source: git
 *     repository: "git+https://github.com/acme/dsui-adapter-thing"
 *     commit: "<full-sha>"
 *     integrity: "sha384-..."
 */
export const adapterEntrySchema = z.union([
  localAdapterSourceSchema,
  packageAdapterSourceSchema,
  npmAdapterSourceSchema,
  gitAdapterSourceSchema,
  adapterOverrideSchema,
]);
export type AdapterEntry = z.infer<typeof adapterEntrySchema>;

/** A package source: a directory, a package name, pinned npm, or git. */
export type AdapterSource =
  | LocalAdapterSource
  | PackageAdapterSource
  | NpmAdapterSource
  | GitAdapterSource;

export function isAdapterSource(entry: AdapterEntry): entry is AdapterSource {
  if ("source" in entry) {
    // `git` and `local` are both buildable sources; an entry without a source
    // is a presentation override, which is not a source at all.
    return entry.source === "git" || entry.source === "local";
  }
  return "package" in entry;
}

export function adapterSourceEntries(
  config: DsuiConfig,
): Array<[string, AdapterSource]> {
  return Object.entries(config.adapters ?? {}).filter(
    (entry): entry is [string, AdapterSource] => isAdapterSource(entry[1]),
  );
}

/** Maps a parsed `adapters:` entry to the loader's package-source shape. */
export function toAdapterPackageSource(
  entry: AdapterSource,
): AdapterPackageSource {
  if ("source" in entry && entry.source === "git") {
    // A source-built git adapter carries `ref`/`path` and no SRI; only the
    // pinned form maps onto the package-source shape.
    return {
      source: "git",
      repository: entry.repository,
      ...(entry.commit ? { commit: entry.commit } : {}),
      ...(entry.integrity ? { integrity: entry.integrity } : {}),
      ...(entry.entry ? { entry: entry.entry } : {}),
    } as AdapterPackageSource;
  }
  if ("source" in entry) {
    // `local` is built by `toAdapterSourceLocation`, not imported by package.
    return { package: "" };
  }
  if ("version" in entry)
    return {
      package: entry.package,
      version: entry.version,
      integrity: entry.integrity,
      ...(entry.entry ? { entry: entry.entry } : {}),
    };
  return { package: entry.package };
}

export const configSchema = z
  .object({
    services: z.array(serviceSchema).default([]),
    auth: z
      .object({ mode: z.enum(["none", "local", "enterprise"]).optional() })
      .optional(),
    adapters: z.record(adapterEntrySchema).optional(),
    plugins: z.record(pluginSourceSchema).optional(),
  })
  .passthrough();

export type ConfiguredService = z.infer<typeof serviceSchema>;
export type DsuiConfig = z.infer<typeof configSchema>;

export async function loadConfig(
  path: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<DsuiConfig> {
  if (!path) return { services: [] };
  const located = await locateConfig(path);
  if (!located)
    throw new ConfigError(`Configuration file was not found: ${path}`);
  let raw: unknown;
  try {
    raw = parseYaml(await readFile(located, "utf8"));
  } catch (error) {
    throw new ConfigError(
      `Could not read configuration: ${error instanceof Error ? error.message : "invalid YAML"}`,
    );
  }
  try {
    return configSchema.parse(interpolate(raw ?? {}, environment));
  } catch (error) {
    throw new ConfigError(
      `Invalid configuration: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
