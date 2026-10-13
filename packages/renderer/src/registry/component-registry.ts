import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { ComponentType, ReactNode } from "react";
import { Chart } from "../components/chart";
import type { RendererClient } from "../types/renderer-types";
import { lookupComponent } from "./component-lookup";

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
  components.set(`${adapterId}:./${file}.tsx`, {
    type: "sync",
    component: module.default,
  });
  components.set(`${adapterId}:./components/${file}.tsx`, {
    type: "sync",
    component: module.default,
  });
}

// The chart is a built-in rather than a glob match: it depends on a charting
// library, so it is registered by name instead of discovered from the SDK's
// component directory.
components.set("./ui/chart", { type: "sync", component: Chart });
components.set("chart", { type: "sync", component: Chart });

/** Resolves a component by its declared path or stable id. */
export function resolveComponent(
  id: string,
  path?: string,
): ComponentEntry | null {
  return lookupComponent(components, id, path);
}
