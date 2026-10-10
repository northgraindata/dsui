import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

export const sdkPackages = ["adapter-sdk", "plugin-sdk"] as const;
export type SdkPackage = (typeof sdkPackages)[number];
const root = resolve(import.meta.dir, "..");

interface PackageManifest {
  name: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export async function sdkVersions(): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  for (const directory of sdkPackages) {
    const manifest: PackageManifest = JSON.parse(
      await readFile(join(root, "packages", directory, "package.json"), "utf8"),
    );
    versions[manifest.name] = manifest.version;
  }
  return versions;
}

export function registryRange(
  range: string,
  version: string | undefined,
): string {
  if (!range.startsWith("workspace:")) return range;
  if (!version) throw new Error(`No publishable version for ${range}`);
  const selector = range.slice("workspace:".length);
  if (selector === "*") return version;
  if (selector === "^" || selector === "~") return `${selector}${version}`;
  throw new Error(`Unsupported workspace range: ${range}`);
}

async function rewriteBundledUiImports(sourceRoot: string): Promise<void> {
  const uiEntry = join(sourceRoot, "ui", "index.tsx");
  const visit = async (directoryPath: string): Promise<void> => {
    for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
      const path = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (/\.tsx?$/.test(entry.name)) {
        const bundledUi = relative(dirname(path), uiEntry).split(sep).join("/");
        const specifier = bundledUi.startsWith(".")
          ? bundledUi
          : `./${bundledUi}`;
        const sourceText = await readFile(path, "utf8");
        await writeFile(
          path,
          sourceText.replaceAll(
            '"@northgraindata/dsui-ui"',
            JSON.stringify(specifier),
          ),
        );
      }
    }
  };
  await visit(sourceRoot);
}

async function embedUiImplementation(target: string): Promise<void> {
  const uiSource = join(root, "packages", "ui", "src");
  const sourceRoot = join(target, "src");
  await cp(uiSource, join(sourceRoot, "ui"), { recursive: true });
  await rewriteBundledUiImports(sourceRoot);
  const adapterStyles = join(sourceRoot, "styles.css");
  const uiStyles = await readFile(join(uiSource, "styles.css"), "utf8");
  const currentStyles = await readFile(adapterStyles, "utf8");
  await writeFile(adapterStyles, `${uiStyles}\n${currentStyles}`);
}

/** Bun-native source exports preserve all TS/TSX subpaths and their types. */
export async function packageSdk(directory: SdkPackage): Promise<string> {
  const source = join(root, "packages", directory);
  const target = join(root, "dist", "sdk", directory);
  const versions = await sdkVersions();
  const manifest: PackageManifest = JSON.parse(
    await readFile(join(source, "package.json"), "utf8"),
  );
  const {
    private: _private,
    devDependencies: _dev,
    scripts: _scripts,
    ...published
  } = manifest;
  if (directory === "adapter-sdk") {
    const ui: PackageManifest = JSON.parse(
      await readFile(join(root, "packages", "ui", "package.json"), "utf8"),
    );
    const dependencies = {
      ...ui.dependencies,
      ...published.dependencies,
    } as Record<string, string>;
    delete dependencies[ui.name];
    published.dependencies = dependencies;
    published.peerDependencies = {
      ...ui.peerDependencies,
      ...published.peerDependencies,
    };
  }
  for (const field of ["dependencies", "peerDependencies"] as const) {
    if (!published[field]) continue;
    published[field] = Object.fromEntries(
      Object.entries(published[field]).map(([name, range]) => [
        name,
        registryRange(range, versions[name]),
      ]),
    );
  }
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(join(source, "src"), join(target, "src"), {
    recursive: true,
    filter: (path) => !/\.(test|spec)\.tsx?$/.test(path),
  });
  if (directory === "adapter-sdk") await embedUiImplementation(target);
  await cp(join(root, "LICENSE"), join(target, "LICENSE"));
  {
    let readme = await readFile(join(source, "README.md"), "utf8");
    readme = readme
      .replaceAll(
        "](./assets/",
        `](https://raw.githubusercontent.com/northgraindata/dsui/main/packages/${directory}/assets/`,
      )
      .replace(
        /\]\(\.\.\/([^)]*)\)/g,
        (_, path: string) =>
          `](https://github.com/northgraindata/dsui/tree/main/${resolve(source, "..", path).slice(root.length + 1)})`,
      )
      .replace(
        /\]\(\.\/src\/([^)]*)\)/g,
        (_, path: string) =>
          `](https://github.com/northgraindata/dsui/blob/main/packages/${directory}/src/${path})`,
      );
    await writeFile(join(target, "README.md"), readme);
  }
  await writeFile(
    join(target, "package.json"),
    `${JSON.stringify(
      {
        ...published,
        files: ["src", "LICENSE", "README.md"],
        license: "Apache-2.0",
        engines: { bun: ">=1.3.12" },
        repository: {
          type: "git",
          url: "https://github.com/northgraindata/dsui.git",
          directory: `packages/${directory}`,
        },
        publishConfig: { access: "public" },
      },
      null,
      2,
    )}\n`,
  );
  return target;
}

if (import.meta.main) {
  const directory = process.argv[2];
  if (directory !== "adapter-sdk" && directory !== "plugin-sdk") {
    throw new Error(
      "Usage: bun scripts/release-packages.ts <adapter-sdk|plugin-sdk>",
    );
  }
  console.log(await packageSdk(directory));
}
