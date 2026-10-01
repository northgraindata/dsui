/**
 * Verifies that a package's browser bundle covers every custom component it
 * declares.
 *
 * A `defineComponent` with a `path` renders as a reference the host resolves in
 * the browser, so the implementation has to be reachable from the browser
 * bundle. If it is not, the component renders as "Unknown component" in the
 * page and nothing fails. This turns that into a build error naming the ids.
 *
 * Discovery is by source scan rather than by the host runtime: the host never
 * sees a `defineComponent` call, only the serialized node it produces.
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

/** A custom component an adapter declares for the browser. */
export interface ComponentDeclaration {
  /** The `id` from `defineComponent`, e.g. `"s3/storage-workspace"`. */
  id: string;
  /** Module path from the declaring file, as written in the definition. */
  path: string;
  /** The file that declares it, relative to the package root. */
  declaredIn: string;
}

/** A declared component the browser bundle does not export. */
export type UncoveredComponent = ComponentDeclaration;

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/** A component found in a source file, before it is attributed to a package. */
interface SourceDeclaration {
  /** The `id` from `defineComponent`, e.g. `"s3/storage-workspace"`. */
  id: string;
  /** Module path from the declaring file, as written in the definition. */
  path: string;
}

/**
 * Components a source file declares for the browser.
 *
 * A `defineComponent` with a `path` resolves to a module the host loads in the
 * browser, so both the id and the path are needed: the id to check coverage, the
 * path to serve the component in listings.
 */
function declaredComponents(source: string): SourceDeclaration[] {
  const declarations: SourceDeclaration[] = [];
  // Each `defineComponent({ ... })` argument object, matched without nesting
  // because the option bag is flat in practice and this avoids parsing.
  for (const match of source.matchAll(
    /defineComponent(?:<[^>]*>)?\s*\(\s*\{([\s\S]*?)\n?\s*\}\s*\)/g,
  )) {
    const body = match[1];
    const path = /\bpath\s*:\s*["'`]([^"'`]+)["'`]/.exec(body)?.[1];
    if (!path) continue;
    const id = /\bid\s*:\s*["'`]([^"'`]+)["'`]/.exec(body)?.[1];
    if (id) declarations.push({ id, path });
  }
  return declarations;
}

/** Component ids a built browser bundle exposes. */
export function exportedComponentIds(bundle: string): Set<string> {
  const ids = new Set<string>();
  for (const match of bundle.matchAll(
    /["'`]([a-z][a-z0-9-]*(?:\/[a-z0-9._-]+)+)["'`]\s*:/g,
  ))
    ids.add(match[1]);
  // `createComponents` is a common implementation shape; keys may appear as an
  // object literal or a quoted property.
  for (const match of bundle.matchAll(/\["([^"]+)"\]\s*=/g)) ids.add(match[1]);
  for (const match of bundle.matchAll(
    /["'`]([a-z][a-z0-9-]*(?:\/[a-z0-9._-]+)+)["'`]\s*[:,]/g,
  ))
    ids.add(match[1]);
  return ids;
}

async function* sourceFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (SOURCE_EXTENSIONS.includes(extname(entry.name))) yield path;
  }
}

/** Every custom component a package declares, with its declaring file. */
export async function declaredPackageComponents(options: {
  packageRoot: string;
}): Promise<ComponentDeclaration[]> {
  const declarations: ComponentDeclaration[] = [];
  for await (const file of sourceFiles(join(options.packageRoot, "src"))) {
    const source = await readFile(file, "utf8");
    for (const declaration of declaredComponents(source))
      declarations.push({
        ...declaration,
        declaredIn: relative(options.packageRoot, file),
      });
  }
  return declarations;
}

/**
 * Lists components declared in `packageRoot` with a `path` that the browser
 * bundle does not export.
 */
export async function findUncoveredComponents(options: {
  packageRoot: string;
  browserBundlePath: string;
}): Promise<UncoveredComponent[]> {
  const exported = exportedComponentIds(
    await readFile(options.browserBundlePath, "utf8"),
  );
  if (!exported.size) return [];
  const uncovered: UncoveredComponent[] = [];
  for (const declaration of await declaredPackageComponents(options))
    if (!exported.has(declaration.id)) uncovered.push(declaration);
  return uncovered;
}

/**
 * Throws when a browser bundle misses a declared component.
 *
 * A package with no browser entry is left alone: an adapter composed entirely
 * of builtin components needs none, and only the ones declaring a `path`
 * require the host to render in the browser.
 */
export async function assertBrowserBundleCovers(options: {
  packageRoot: string;
  browserBundlePath?: string;
  packageName: string;
}): Promise<void> {
  if (!options.browserBundlePath) return;
  const uncovered = await findUncoveredComponents({
    packageRoot: options.packageRoot,
    browserBundlePath: options.browserBundlePath,
  });
  if (!uncovered.length) return;
  const details = uncovered
    .map((entry) => `  - ${entry.id} (declared in ${entry.declaredIn})`)
    .join("\n");
  throw new Error(
    `${options.packageName} declares custom components its browser bundle does not export.\n` +
      `Add each id to the createComponents map in the browser entry:\n${details}`,
  );
}
