import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ComponentFile,
  findDrift,
  findIndexDrift,
} from "./component-drift";
import { getPrimitiveDocs, type PrimitiveTypeDoc } from "./primitive-catalog";

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
}

export interface ComponentPage {
  slug: string;
  name: string;
  description: string;
  example: string;
  props: ComponentProp[];
  supportingTypes: PrimitiveTypeDoc[];
  sourcePath: string;
}

const files = import.meta.glob<ComponentFile>("../content/components/*.json", {
  eager: true,
  import: "default",
});

const docsBySlug = new Map(
  Object.entries(files).map(([path, data]) => [
    path
      .split("/")
      .pop()
      ?.replace(/\.json$/, "") ?? path,
    data,
  ]),
);

export async function getComponentPages(): Promise<ComponentPage[]> {
  const primitives = await getPrimitiveDocs();
  const indexSource = await readFile(
    resolve(process.cwd(), "content/docs/build/components/index.mdx"),
    "utf8",
  );
  const problems = [
    ...findDrift(primitives, docsBySlug),
    ...findIndexDrift(
      primitives.map((primitive) => primitive.id),
      indexSource,
    ),
  ];
  if (problems.length > 0) {
    throw new Error(`Component docs are out of date:\n${problems.join("\n")}`);
  }
  return primitives
    .map((primitive) => {
      const doc = docsBySlug.get(primitive.id) as ComponentFile;
      return {
        slug: primitive.id,
        name: doc.name,
        description: doc.description,
        example: doc.example,
        props: primitive.props.map((prop) => ({
          name: prop.name,
          type: prop.type,
          required: prop.required,
          default: doc.props[prop.name]?.default,
          description: doc.props[prop.name]?.description || prop.description,
        })),
        supportingTypes: primitive.supportingTypes,
        sourcePath: primitive.sourcePath,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
