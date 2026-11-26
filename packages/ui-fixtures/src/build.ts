/**
 * Writes the gallery's inputs: serialized nodes for every page of every
 * built-in adapter, plus sample resource data per data scenario.
 */
import { existsSync, readdirSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  collectColumns,
  collectSingletons,
  pageSlug,
  renderPage,
} from "./render";
import { collectResourceTypes, type ResourceTypes } from "./resource-types";
import { sampleFromType } from "./sample";
import type { AdapterFixtures, Shape } from "./types";

const root = resolve(import.meta.dir, "../../..");
const output = join(root, "apps/gallery/.generated");

const DATA_SHAPES = {
  default: { rows: 4, longText: false },
  empty: { rows: 0, longText: false },
  large: { rows: 200, longText: false },
  "long-text": { rows: 4, longText: true },
} satisfies Record<string, Shape>;

const directories = readdirSync(join(root, "packages"))
  .filter((name) => name.startsWith("adapter-") && name !== "adapter-sdk")
  .map((name) => join(root, "packages", name))
  .filter((directory) => existsSync(join(directory, "src/adapter.ts")))
  .sort();

async function loadFixtures(directory: string): Promise<AdapterFixtures> {
  const file = join(directory, "fixtures/fixtures.ts");
  return existsSync(file) ? (await import(file)).default : {};
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 1)}\n`);
}

interface Sources {
  readonly fixtures: AdapterFixtures;
  readonly types: ResourceTypes;
  readonly columns: ReadonlyMap<string, ReadonlySet<string>>;
}

function resourceData(
  { fixtures, types, columns }: Sources,
  resourceId: string,
  shape: Shape,
): { data: unknown; fromColumns: boolean } {
  const override = fixtures.resources?.[resourceId];
  if (override) return { data: override(shape), fromColumns: false };
  const declared = [...(columns.get(resourceId) ?? [])];
  const type = types.outputs.get(resourceId);
  if (type) {
    const data = sampleFromType(types.checker, type, {
      shape,
      columns: declared,
    });
    return { data, fromColumns: false };
  }
  // Resources built by a factory have no literal id to match. They all return
  // rows, so the consuming table's columns describe them.
  const keys = declared.length ? declared : ["name", "status", "value"];
  const data = Array.from({ length: shape.rows }, (_, row) =>
    Object.fromEntries(keys.map((key) => [key, `${key}_${row + 1}`])),
  );
  return { data, fromColumns: true };
}

async function buildAdapter(directory: string, types: ResourceTypes) {
  const { default: adapter } = await import(join(directory, "src/adapter.ts"));
  const fixtures = await loadFixtures(directory);
  const id: string = adapter.metadata.id;
  const target = join(output, id);
  await mkdir(join(target, "pages"), { recursive: true });

  const columns = new Map<string, Set<string>>();
  const singletons = new Set<string>();
  const pages: { path: string; slug: string }[] = [];
  for (const page of adapter.pages) {
    const nodes = await renderPage(adapter, page.path, fixtures);
    collectColumns(nodes, columns);
    collectSingletons(nodes, singletons);
    const slug = pageSlug(page.path);
    await writeJson(join(target, "pages", `${slug}.json`), nodes);
    pages.push({ path: page.path, slug });
  }

  const sources = { fixtures, types, columns };
  const untyped = new Set<string>();
  for (const [scenario, shape] of Object.entries(DATA_SHAPES)) {
    const data: Record<string, unknown> = {};
    for (const resource of adapter.resources) {
      const sampled = resourceData(
        sources,
        resource.id,
        singletons.has(resource.id)
          ? { ...shape, rows: Math.min(shape.rows, 1) }
          : shape,
      );
      data[resource.id] = sampled.data;
      if (sampled.fromColumns) untyped.add(resource.id);
    }
    await writeJson(join(target, `resources.${scenario}.json`), data);
  }
  return {
    id,
    name: adapter.metadata.name as string,
    pages,
    untyped: untyped.size,
  };
}

await rm(output, { recursive: true, force: true });
const types = collectResourceTypes(root, directories);
const manifest: Omit<Awaited<ReturnType<typeof buildAdapter>>, "untyped">[] =
  [];
for (const [index, directory] of directories.entries()) {
  const adapterTypes = types[index];
  if (!adapterTypes) throw new Error(`No types for ${directory}`);
  const { untyped, ...entry } = await buildAdapter(directory, adapterTypes);
  manifest.push(entry);
  console.log(
    `${entry.id}: ${entry.pages.length} pages${untyped ? `, ${untyped} resources sampled from columns` : ""}`,
  );
}
await writeJson(join(output, "manifest.json"), manifest);
