import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ImageDependencies {
  apt?: string[];
  pipx?: string[];
}

const APT_PACKAGE = /^[a-z0-9][a-z0-9+.-]*(?:=[A-Za-z0-9.+:~_-]+)?$/;
const PIPX_PACKAGE =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(?:==[A-Za-z0-9][A-Za-z0-9.+!_-]*)?$/;
const VARIABLE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

function packageList(
  value: unknown,
  manager: keyof ImageDependencies,
  packagePath: string,
): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  )
    throw new Error(`Invalid dsui.image.${manager} in ${packagePath}`);
  return value;
}

function manifestImageDependencies(
  value: unknown,
  packagePath: string,
): Required<ImageDependencies> {
  if (value === undefined) return { apt: [], pipx: [] };
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid dsui.image in ${packagePath}`);

  const image = value as Record<string, unknown>;
  const unknownManager = Object.keys(image).find(
    (manager) => manager !== "apt" && manager !== "pipx",
  );
  if (unknownManager)
    throw new Error(`Unsupported image dependency manager: ${unknownManager}`);

  return {
    apt: packageList(image.apt, "apt", packagePath),
    pipx: packageList(image.pipx, "pipx", packagePath),
  };
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function packageManifestPaths(
  root: string,
  directory: string,
): Promise<string[]> {
  try {
    const entries = await readdir(join(root, directory), {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, directory, entry.name, "package.json"));
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

async function readPackageDependencies(
  packagePath: string,
): Promise<Required<ImageDependencies> | undefined> {
  let source: string;
  try {
    source = await readFile(packagePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
  const manifest = JSON.parse(source) as { dsui?: { image?: unknown } };
  return manifestImageDependencies(manifest.dsui?.image, packagePath);
}

/** Collects declared host packages from workspace adapter and plugin manifests. */
export async function collectImageDependencies(
  root: string,
): Promise<Required<ImageDependencies>> {
  const result: Required<ImageDependencies> = { apt: [], pipx: [] };
  const manifests = [
    ...(await packageManifestPaths(root, "packages")),
    ...(await packageManifestPaths(root, "examples")),
  ];

  for (const packagePath of manifests) {
    const dependencies = await readPackageDependencies(packagePath);
    if (!dependencies) continue;
    result.apt.push(...dependencies.apt);
    result.pipx.push(...dependencies.pipx);
  }

  result.apt = [...new Set(result.apt)].sort();
  result.pipx = [...new Set(result.pipx)].sort();
  return result;
}

function resolvePackageSpec(
  spec: string,
  manager: keyof ImageDependencies,
  env: NodeJS.ProcessEnv,
): string {
  const resolved = spec.replace(VARIABLE, (_match, name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name} for image dependency ${spec}`);
    return value;
  });
  if (resolved.includes("${"))
    throw new Error(
      `Invalid or unresolved variable in image dependency ${spec}`,
    );
  const pattern = manager === "apt" ? APT_PACKAGE : PIPX_PACKAGE;
  if (!pattern.test(resolved))
    throw new Error(`Invalid ${manager} package specification: ${resolved}`);
  return resolved;
}

export function resolveImageDependencies(
  dependencies: ImageDependencies,
  env: NodeJS.ProcessEnv = process.env,
): Required<ImageDependencies> {
  return {
    apt: (dependencies.apt ?? []).map((spec) =>
      resolvePackageSpec(spec, "apt", env),
    ),
    pipx: (dependencies.pipx ?? []).map((spec) =>
      resolvePackageSpec(spec, "pipx", env),
    ),
  };
}

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  const status = await child.exited;
  if (status !== 0)
    throw new Error(`${command.join(" ")} exited with status ${status}`);
}

/** Installs collected image dependencies; called by the Docker build stage. */
export async function installImageDependencies(
  dependencyPath: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const dependencies = resolveImageDependencies(
    JSON.parse(await readFile(dependencyPath, "utf8")) as ImageDependencies,
    env,
  );

  if (dependencies.apt.length > 0) {
    await run(["apt-get", "update"]);
    await run([
      "apt-get",
      "install",
      "--no-install-recommends",
      "--yes",
      ...dependencies.apt,
    ]);
  }

  for (const packageName of dependencies.pipx)
    await run(["pipx", "install", packageName]);
}

async function main(args: string[]): Promise<void> {
  const [mode, value, output] = args;
  if (mode === "collect" && value && output) {
    const dependencies = await collectImageDependencies(value);
    await writeFile(output, `${JSON.stringify(dependencies, null, 2)}\n`);
    return;
  }
  if (mode === "install" && value) {
    await installImageDependencies(value);
    return;
  }
  throw new Error(
    "Usage: image-dependencies.ts collect <workspace-root> <output.json> | install <dependencies.json>",
  );
}

if (import.meta.main) await main(Bun.argv.slice(2));
