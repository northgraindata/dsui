import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { ComponentType, ReactNode } from "react";
import type { RendererClient } from "../types/renderer-types";

export interface ComponentProps {
  client: RendererClient;
  node: PageNode;
  renderNode: (
    client: RendererClient,
    node: PageNode,
    context?: Record<string, unknown>,
  ) => ReactNode;
  context?: Record<string, unknown>;
}

type ComponentEntry = {
  type: "sync";
  component: ComponentType<ComponentProps>;
};

const components = new Map<string, ComponentEntry>();

const sdkComponents = import.meta.glob(
  "../../../adapter-sdk/src/components/ui/**/*.tsx",
  { eager: true },
) as Record<string, { default?: ComponentType<ComponentProps> }>;

const localAdapterComponents = import.meta.glob(
  "../../../adapter-*/src/components/*.tsx",
  { eager: true },
) as Record<string, { default?: ComponentType<ComponentProps> }>;

for (const [path, module] of Object.entries(sdkComponents)) {
  if (!module.default) continue;
  const file = path
    .split("/")
    .at(-1)
    ?.replace(/\.tsx$/, "");
  if (file && file !== "index") {
    components.set(file, { type: "sync", component: module.default });
    components.set(`./ui/${file}`, { type: "sync", component: module.default });
  }
}

for (const [path, module] of Object.entries(localAdapterComponents)) {
  if (!module.default) continue;
  const parts = path.split("/");
  const adapter = parts.find((part) => part.startsWith("adapter-"));
  const file = parts.at(-1)?.replace(/\.tsx$/, "");
  if (!adapter || !file) continue;
  const adapterId = adapter.slice("adapter-".length);
  components.set(`${adapterId}/${file}`, {
    type: "sync",
    component: module.default,
  });
  components.set(`./${file}.tsx`, {
    type: "sync",
    component: module.default,
  });
  components.set(`./components/${file}.tsx`, {
    type: "sync",
    component: module.default,
  });
}

/** Resolves a component by its declared path or stable id. */
export function resolveComponent(
  id: string,
  path?: string,
): ComponentEntry | null {
  return components.get(path ?? "") ?? components.get(id) ?? null;
}
