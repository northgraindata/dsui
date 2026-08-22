import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import {
  type CommunityAdapterSource,
  communityAdapterSourceSchema,
} from "./external-adapters";

const envToken = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
const httpUrl = /^https?:\/\//i;

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

/** Per-adapter presentation overrides keyed by adapter id. */
export const adapterOverrideSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    category: z.string().min(1).max(80).optional(),
    description: z.string().min(1).max(400).optional(),
    logo: z.string().min(1).max(2048).optional(),
  })
  .strict();
export type AdapterOverride = z.infer<typeof adapterOverrideSchema>;

/**
 * An `adapters:` entry is either a presentation override for a built-in or a
 * community source definition under a logical id, e.g.:
 *
 * adapters:
 *   polaris-npm:
 *     source: npm
 *     package: "@acme/dsui-adapter-polaris"
 *     version: "1.2.3"
 *     integrity: "sha512-..."
 */
export const adapterEntrySchema = z.union([
  communityAdapterSourceSchema,
  adapterOverrideSchema,
]);
export type AdapterEntry = z.infer<typeof adapterEntrySchema>;

export function isCommunityAdapterSource(
  entry: AdapterEntry,
): entry is CommunityAdapterSource {
  return "source" in entry;
}

export function communityAdapterEntries(
  config: DsuiConfig,
): Array<[string, CommunityAdapterSource]> {
  return Object.entries(config.adapters ?? {}).filter(
    (entry): entry is [string, CommunityAdapterSource] =>
      isCommunityAdapterSource(entry[1]),
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
    raw = parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new ConfigError(
      `Could not read configuration: ${error instanceof Error ? error.message : "invalid YAML"}`,
    );
  }
  try {
    const parsed = configSchema.parse(interpolate(raw ?? {}, environment));
    return resolveAdapterLogos(parsed, path);
  } catch (error) {
    throw new ConfigError(
      `Invalid configuration: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/** Relative logo paths are stored absolute, anchored at the config file. */
function resolveAdapterLogos(config: DsuiConfig, path: string): DsuiConfig {
  if (!config.adapters) return config;
  const base = dirname(path);
  for (const entry of Object.values(config.adapters)) {
    if ("logo" in entry && entry.logo && !httpUrl.test(entry.logo))
      entry.logo = resolve(base, entry.logo);
  }
  return config;
}
