import { Badge, Card, type PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { CatalogEntry } from "./catalog-types";
import { type Scenario, scenarios } from "./fixtures";
import { NodePreview } from "./preview";

export const detail = () =>
  Card({
    title: "Production",
    description: "Shared SDK content",
    content: Badge({ label: "Connected", tone: "healthy" }),
  });
export function block(
  id: string,
  variants: Record<string, () => PageNode>,
  description = "Production SDK block rendered through the page serializer and registry.",
): CatalogEntry {
  return {
    id: `sdk/${id}`,
    title: id,
    group: "SDK blocks",
    description,
    source: `packages/adapter-sdk/src/components/primitives/${id.replace(/-variants$/, "")}.ts`,
    examples: Object.entries(variants).map(([name, build]) => ({
      id: name,
      title: name,
      render: (scenario) => (
        <NodePreview scenario={scenario} nodes={[build()]} />
      ),
    })),
  };
}
export function bound(
  id: string,
  build: (scenario: Scenario) => PageNode,
): CatalogEntry {
  return {
    id: `sdk/${id}`,
    title: id,
    group: "SDK blocks",
    description:
      "All resource states shown side by side. Loading stays pending; error is returned by the fixture client.",
    source: `packages/adapter-sdk/src/components/primitives/${id.replace(/-variants$/, "")}.ts`,
    examples: scenarios.map((scenario) => ({
      id: scenario,
      title: scenario,
      scenario,
      render: () => (
        <NodePreview scenario={scenario} nodes={[build(scenario)]} />
      ),
    })),
  };
}
