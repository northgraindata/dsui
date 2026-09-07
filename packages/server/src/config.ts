import { access, readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const envToken = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

export class ConfigError extends Error {}

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
 * A local adapter package resolved by name and imported in-process.
 * Workspace packages and node_modules entries both work.
 */
export const localAdapterSourceSchema = z
  .object({ package: z.string().min(1) })
  .strict();
export type LocalAdapterSource = z.infer<typeof localAdapterSourceSchema>;

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
 * An `adapters:` entry is either a package source (local or pinned npm)
 * or a presentation override for an already-registered adapter, e.g.:
 *
 * adapters:
 *   snowflake:
 *     package: "@northgraindata/dsui-adapter-snowflake"
 *   acme-thing:
 *     package: "@acme/dsui-adapter-thing"
 *     version: "1.2.3"
 *     integrity: "sha512-..."
 */
export const adapterEntrySchema = z.union([
  localAdapterSourceSchema,
  npmAdapterSourceSchema,
  adapterOverrideSchema,
]);
export type AdapterEntry = z.infer<typeof adapterEntrySchema>;

export function isAdapterSource(
  entry: AdapterEntry,
): entry is LocalAdapterSource | NpmAdapterSource {
  return "package" in entry;
}

export function adapterSourceEntries(
  config: DsuiConfig,
): Array<[string, LocalAdapterSource | NpmAdapterSource]> {
  return Object.entries(config.adapters ?? {}).filter(
    (entry): entry is [string, LocalAdapterSource | NpmAdapterSource] =>
      isAdapterSource(entry[1]),
  );
}

export const configSchema = z
  .object({
    services: z.array(serviceSchema).default([]),
    auth: z
      .object({ mode: z.enum(["none", "local", "enterprise"]).optional() })
      .optional(),
    adapters: z.record(adapterEntrySchema).optional(),
  })
  .passthrough();

export type ConfiguredService = z.infer<typeof serviceSchema>;
export type DsuiConfig = z.infer<typeof configSchema>;

export async function loadConfig(
  path: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<DsuiConfig> {
  if (!path) return { services: [] };
  try {
    await access(path);
  } catch {
    throw new ConfigError(`Configuration file was not found: ${path}`);
  }
  let raw: unknown;
  try {
    raw = parseYaml(await readFile(path, "utf8"));
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
