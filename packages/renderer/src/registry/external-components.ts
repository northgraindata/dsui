import type { ComponentType } from "react";
import type { ComponentProps } from "./component-registry";

type ComponentBundle =
  | Record<string, ComponentType<ComponentProps>>
  | {
      default?: Record<string, ComponentType<ComponentProps>>;
      components?: Record<string, ComponentType<ComponentProps>>;
    };

const bundles = new Map<string, Promise<ComponentBundle>>();

export function loadExternalComponent(
  componentId: string,
  browserUrl?: string,
): Promise<ComponentType<ComponentProps> | null> {
  const adapterId = componentId.split("/", 1)[0];
  if (!adapterId) return Promise.resolve(null);
  let bundle = bundles.get(adapterId);
  if (!bundle) {
    bundle = import(
      /* @vite-ignore */
      browserUrl ??
        `/api/v1/adapters/${encodeURIComponent(adapterId)}/components.mjs`
    ) as Promise<ComponentBundle>;
    bundles.set(adapterId, bundle);
  }
  return bundle
    .then((module) => {
      const components = (
        "default" in module
          ? module.default
          : "components" in module
            ? module.components
            : module
      ) as Record<string, ComponentType<ComponentProps>> | undefined;
      return components?.[componentId] ?? null;
    })
    .catch(() => null);
}
