import { type CollectionEntry, getCollection } from "astro:content";
import * as path from "node:path";
import { type StructuredData, structure } from "fumadocs-core/mdx-plugins";
import type { StaticSource } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";
import { components } from "./component-catalog";

export const source = loader({
  source: await createSource(),
  baseUrl: "/docs",
});
export const getStructuredData = (
  entry: CollectionEntry<"docs">,
): StructuredData => structure(entry.body ?? "");

async function createSource() {
  const out: StaticSource<{
    metaData: CollectionEntry<"meta">["data"];
    pageData: CollectionEntry<"docs">["data"] & {
      _raw: CollectionEntry<"docs">;
    };
  }> = { files: [] };
  for (const page of await getCollection("docs")) {
    const filePath = page.filePath;
    if (!filePath) continue;
    out.files.push({
      type: "page",
      path: path.relative("content/docs", filePath),
      data: { ...page.data, _raw: page },
    });
  }
  for (const meta of await getCollection("meta")) {
    const filePath = meta.filePath;
    if (!filePath) continue;
    out.files.push({
      type: "meta",
      path: path.relative("content/docs", filePath),
      data: meta.data,
    });
  }
  for (const comp of components) {
    const syntheticEntry = {
      id: `adapter-sdk/components/${comp.slug}`,
      body: "",
      data: { title: comp.name, description: comp.description },
      filePath: `content/docs/adapter-sdk/components/${comp.slug}.mdx`,
      rendered: undefined,
      digest: "",
    } as unknown as CollectionEntry<"docs">;
    out.files.push({
      type: "page",
      path: `adapter-sdk/components/${comp.slug}.mdx`,
      data: {
        title: comp.name,
        description: comp.description,
        _raw: syntheticEntry,
      },
    });
  }
  return out;
}
