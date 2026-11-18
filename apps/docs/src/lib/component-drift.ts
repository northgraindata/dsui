import type { PrimitiveDoc } from "./primitive-catalog";

export interface ComponentFile {
  name: string;
  description: string;
  example: string;
  props: Record<string, { description?: string; default?: string }>;
}

/** Fails the build when the docs and the SDK source disagree. */
export function findDrift(
  primitives: PrimitiveDoc[],
  docs: Map<string, ComponentFile>,
): string[] {
  const problems: string[] = [];
  const ids = new Set(primitives.map((primitive) => primitive.id));
  for (const primitive of primitives) {
    if (!docs.has(primitive.id)) {
      problems.push(
        `${primitive.id}: no docs in src/content/components/${primitive.id}.json`,
      );
    }
  }
  for (const [slug, doc] of docs) {
    const primitive = primitives.find((candidate) => candidate.id === slug);
    if (!primitive) {
      problems.push(`${slug}: documented, but no such SDK primitive`);
      continue;
    }
    const names = new Set(primitive.props.map((prop) => prop.name));
    for (const name of Object.keys(doc.props)) {
      if (!names.has(name)) {
        problems.push(`${slug}.${name}: documented prop is not in the SDK`);
      }
    }
  }
  return ids.size === 0 ? ["no SDK primitives found"] : problems;
}

/** Every component page must be linked from the components index page. */
export function findIndexDrift(slugs: string[], indexSource: string): string[] {
  return slugs
    .filter((slug) => !indexSource.includes(`(/docs/build/components/${slug})`))
    .map((slug) => `${slug}: not linked from build/components/index.mdx`);
}
