import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { PublicAdapter } from "@northgraindata/dsui-core";
import type { Scenario } from "@northgraindata/dsui-ui-fixtures";

export interface ManifestPage {
  path: string;
  slug: string;
  /** The page's concrete URL inside the application, with fixture params. */
  href: string;
}

export interface ManifestAdapter {
  id: string;
  name: string;
  catalog: Omit<PublicAdapter, "pages" | "components">;
  pages: ManifestPage[];
  /** Fixture file per URL whose query changes what the page renders. */
  variants: Record<string, string>;
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

export const loadNodes = (adapter: string, slug: string) =>
  load<readonly PageNode[]>(`${adapter}/pages/${slug}.json`);

export interface FixtureData {
  resources: Record<string, unknown>;
  actions: Record<string, unknown>;
}

export async function loadData(
  adapter: string,
  scenario: Scenario,
): Promise<FixtureData> {
  // Loading and error never deliver data, so they reuse the default set.
  const set =
    scenario === "loading" || scenario === "error" ? "default" : scenario;
  const [resources, actions] = await Promise.all([
    load<Record<string, unknown>>(`${adapter}/resources.${set}.json`),
    load<Record<string, unknown>>(`${adapter}/actions.${set}.json`),
  ]);
  return { resources, actions };
}

export interface Fixture extends FixtureData {
  nodes: readonly PageNode[];
}

export async function loadFixture(
  adapter: string,
  slug: string,
  scenario: Scenario,
): Promise<Fixture> {
  const [nodes, data] = await Promise.all([
    loadNodes(adapter, slug),
    loadData(adapter, scenario),
  ]);
  return { nodes, ...data };
}
