import type { ComponentType } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import type { ComponentProps } from "./component-registry";

type ComponentBundle = {
  default?: Record<string, ComponentType<ComponentProps>>;
  components?: Record<string, ComponentType<ComponentProps>>;
  createComponents?: (
    react: typeof React,
    reactDOM: typeof ReactDOM,
  ) => Record<string, ComponentType<ComponentProps>>;
};

const bundles = new Map<string, Promise<ComponentBundle>>();

export function loadExternalComponent(
  componentId: string,
  browserUrl?: string,
): Promise<ComponentType<ComponentProps> | null> {
  // `browserUrl` is filled in by the host, which knows whether the component
  // came from an adapter or a plugin. Guessing the URL from the id prefix sent
  // a plugin's own component to `/api/v1/adapters/...`, where no such adapter
  // exists, so the lookup failed on a 404 for a bundle that was served all
  // along. Only adapters fall back to a derived path.
  const adapterId = componentId.split("/", 1)[0];
  if (!browserUrl && !adapterId) return Promise.resolve(null);
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
        ? module.createComponents(React, ReactDOM)
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
