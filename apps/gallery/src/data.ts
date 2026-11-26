import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { Scenario } from "@northgraindata/dsui-ui-fixtures";

export interface ManifestAdapter {
  id: string;
  name: string;
  pages: { path: string; slug: string }[];
}

const files = import.meta.glob("../.generated/**/*.json", {
  import: "default",
});

async function load<T>(path: string): Promise<T> {
  const loader = files[`../.generated/${path}`];
  if (!loader)
    throw new Error(`Missing ${path}. Run "bun run fixtures:build" first.`);
  return (await loader()) as T;
}

export const loadManifest = () => load<ManifestAdapter[]>("manifest.json");

export interface Fixture {
  nodes: readonly PageNode[];
  resources: Record<string, unknown>;
}

export async function loadFixture(
  adapter: string,
  slug: string,
  scenario: Scenario,
): Promise<Fixture> {
  // Loading and error never deliver data, so they reuse the default set.
  const dataScenario =
    scenario === "loading" || scenario === "error" ? "default" : scenario;
  const [nodes, resources] = await Promise.all([
    load<readonly PageNode[]>(`${adapter}/pages/${slug}.json`),
    load<Record<string, unknown>>(`${adapter}/resources.${dataScenario}.json`),
  ]);
  return { nodes, resources };
}
