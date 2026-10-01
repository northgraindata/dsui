import type { ComponentType } from "react";
import * as React from "react";
import type { ComponentProps } from "./component-registry";

type ComponentBundle = {
  default?: Record<string, ComponentType<ComponentProps>>;
  components?: Record<string, ComponentType<ComponentProps>>;
  createComponents?: (
    react: typeof React,
  ) => Record<string, ComponentType<ComponentProps>>;
};

const bundles = new Map<string, Promise<ComponentBundle>>();

export function loadExternalComponent(
  componentId: string,
  browserUrl?: string,
): Promise<ComponentType<ComponentProps> | null> {
  const adapterId = componentId.split("/", 1)[0];
  if (!adapterId) return Promise.resolve(null);
  const url =
    browserUrl ??
    `/api/v1/adapters/${encodeURIComponent(adapterId)}/components.mjs`;
  let bundle = bundles.get(url);
  if (!bundle) {
    bundle = import(/* @vite-ignore */ url) as Promise<ComponentBundle>;
    bundles.set(url, bundle);
  }
  return bundle
    .then((module) => {
      const components = module.createComponents
        ? module.createComponents(React)
        : (module.default ?? module.components);
      if (components) return components[componentId] ?? null;
      const legacy = Object.getOwnPropertyDescriptor(
        module,
        componentId,
      )?.value;
      return typeof legacy === "function"
        ? (legacy as ComponentType<ComponentProps>)
        : null;
    })
    .catch(() => null);
}
