/**
 * Prepares the self-contained workspace package trees extension builds need.
 * The public Adapter SDK artifact embeds the private UI implementation, while
 * the product runtime keeps UI, Adapter SDK and Plugin SDK as separate trees.
 * This lets source checkouts resolve the same package layout as the workspace.
 *
 * A released DSUI ships both trees; a source checkout builds them on first use.
 * Without them a plugin build fails on `workspace:*`, because a plugin lives
 * outside this repository and bun has no workspace to resolve against.
 */
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Manifest {
  name?: string;
  version?: string;
  private?: boolean;
  peerDependencies?: Record<string, string>;
  [field: string]: unknown;
}

const UI = "@northgraindata/dsui-ui";
const ADAPTER_SDK = "@northgraindata/dsui-adapter-sdk";
const PLUGIN_SDK = "@northgraindata/dsui-plugin-sdk";

/** Packages prepared into the tree, in dependency order. */
const TREE = [
  { directory: "ui", name: UI },
  { directory: "adapter-sdk", name: ADAPTER_SDK },
  { directory: "plugin-sdk", name: PLUGIN_SDK },
] as const;

const SDK_SOURCE_MARKER = ".source-hash";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function hashSources(packagesDir: string): Promise<string> {
  const hash = createHash("sha256");
  const visit = async (directory: string, prefix: string) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relative = join(prefix, entry.name);
      if (entry.isDirectory()) {
        await visit(path, relative);
      } else if (entry.isFile()) {
        hash.update(relative);
        hash.update(await readFile(path));
      }
    }
  };

  for (const { directory, name } of TREE) {
    const packageDir = join(packagesDir, directory);
    hash.update(name);
    hash.update(await readFile(join(packageDir, "package.json")));
    await visit(join(packageDir, "src"), name);
  }
  return hash.digest("hex");
}

/** Path of one prepared package inside a tree. */
export function sdkPackageAt(root: string, name: string): string {
  return join(root, "node_modules", ...name.split("/"));
}

/**
 * Promotes a peer dependency so a package resolves it itself.
 *
 * Kept as the version the monorepo already uses, which is what stops a plugin
 * from ending up with a second React copy alongside the host's.
 */
function selfContained(manifest: Manifest): Manifest {
  const { peerDependencies, devDependencies, private: _p, ...rest } = manifest;
  const next: Manifest = {
    ...rest,
    dependencies: { ...((rest.dependencies as object) ?? {}) },
  };
  const dependencies = next.dependencies as Record<string, string>;
  for (const [name, range] of Object.entries(peerDependencies ?? {}))
    dependencies[name] ??= range;
  void devDependencies;
  return next;
}

/**
 * Copies the SDK sources into `target` and rewrites their manifests so no
 * workspace or peer range survives.
 *
 * Sources rather than a bundle, because adapters and plugins import deep
 * subpaths such as `@northgraindata/dsui-adapter-sdk/components/ui/table` and
 * a single entry point would not satisfy them.
 *
 * @param packagesDir - Directory holding `ui/`, `adapter-sdk/`, `plugin-sdk/`.
 * @param target - Root receiving `node_modules/@northgraindata/*`.
 * @param install - Run `bun install` for each package. Off in tests.
 */
export async function prepareSdk(
  packagesDir: string,
  target: string,
  install = true,
): Promise<void> {
  for (const { directory, name } of TREE) {
    const source = join(packagesDir, directory);
    const destination = sdkPackageAt(target, name);
    const manifest = JSON.parse(
      await readFile(join(source, "package.json"), "utf8"),
    ) as Manifest;
    if (manifest.name !== name)
      throw new Error(
        `Expected ${name} in ${source}, found ${String(manifest.name)}`,
      );
    await mkdir(destination, { recursive: true });
    const sourceDestination = join(destination, "src");
    await rm(sourceDestination, {
      recursive: true,
      force: true,
    });
    await cp(join(source, "src"), join(destination, "src"), {
      recursive: true,
    });
    const prepared = selfContained(manifest);
    const dependencies = (prepared.dependencies ?? {}) as Record<
      string,
      string
    >;
    // A workspace range becomes a `file:` range onto the sibling package in
    // this tree. The path is absolute because the manifest is rewritten once
    // and every later reference has to survive the tree being moved.
    for (const dep of Object.keys(dependencies))
      if (dependencies[dep].startsWith("workspace:"))
        dependencies[dep] = `file:${sdkPackageAt(target, dep)}`;
    await writeFile(
      join(destination, "package.json"),
      `${JSON.stringify(prepared, null, 2)}\n`,
      "utf8",
    );
    // Dependencies sit beside the sources because a plugin install links these
    // packages rather than copying them, so their own imports resolve here.
    if (install) {
      const child = Bun.spawn(
        ["bun", "install", "--ignore-scripts", "--no-save"],
        { cwd: destination, stdout: "inherit", stderr: "inherit" },
      );
      if ((await child.exited) !== 0)
        throw new Error(`Failed to install dependencies for ${name}`);
    }
  }
}

/**
 * Locates the prepared SDK trees a plugin or adapter build resolves against.
 *
 * An explicit root wins: a compiled binary has no resolvable `import.meta.url`
 * to walk up from, and the launcher knows where the package keeps them. Failing
 * that, a shipped tree is used; failing that, a source checkout builds one from
 * `packages/` on first use and reuses it afterwards.
 */
export async function resolveSdkRoot(options: {
  dataDir: string;
  version: string;
  /** Injected for tests; defaults to the running server module. */
  moduleDir?: string;
}): Promise<string> {
  const configured = process.env.DSUI_SDK_ROOT;
  if (configured) {
    if (
      await exists(join(sdkPackageAt(configured, PLUGIN_SDK), "package.json"))
    )
      return configured;
    throw new Error(`DSUI_SDK_ROOT has no plugin SDK: ${configured}`);
  }

  const moduleDir =
    options.moduleDir ?? dirname(fileURLToPath(import.meta.url));
  const shipped = join(moduleDir, "..", "..", "sdk");
  if (await exists(join(sdkPackageAt(shipped, PLUGIN_SDK), "package.json")))
    return shipped;

  for (let depth = 1; depth <= 6; depth += 1) {
    const candidate = join(
      moduleDir,
      ...Array.from({ length: depth }, () => ".."),
      "packages",
      "adapter-sdk",
    );
    if (await exists(candidate)) {
      const target = join(options.dataDir, "sdk");
      const sourceHash = await hashSources(dirname(candidate));
      let preparedHash = "";
      try {
        preparedHash = await readFile(join(target, SDK_SOURCE_MARKER), "utf8");
      } catch {
        // A tree made by an older host has no source marker and must refresh.
      }
      if (preparedHash !== sourceHash) {
        await prepareSdk(dirname(candidate), target);
        await writeFile(join(target, SDK_SOURCE_MARKER), sourceHash, "utf8");
      }
      return target;
    }
  }
  throw new Error(
    "Could not locate the plugin SDK. A released DSUI ships it under `sdk/`; a source checkout needs `packages/plugin-sdk`.",
  );
}

/** The prepared SDK packages, for diagnostics. */
export async function preparedSdkNames(root: string): Promise<string[]> {
  const names: string[] = [];
  for (const { name } of TREE)
    if (await exists(join(sdkPackageAt(root, name), "package.json")))
      names.push(name);
  return names;
}
