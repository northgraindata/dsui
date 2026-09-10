import type { PageNode } from "@northgraindata/dsui-core";
import type { ComponentType, ReactNode } from "react";
import type { RendererClient } from "./types";

/**
 * Props every registry view receives. Views ignore what they do not
 * need; `renderNode` renders nested nodes (sections, columns, panes).
 */
export interface RegistryViewProps {
  client: RendererClient;
  node: PageNode;
  renderNode: (client: RendererClient, node: PageNode) => ReactNode;
}

type ViewLoader = () => Promise<{
  default: ComponentType<RegistryViewProps>;
}>;

type RegistryEntry =
  | { type: "sync"; view: ComponentType<RegistryViewProps> }
  | { type: "lazy"; loader: ViewLoader };

const entries = new Map<string, RegistryEntry>();

/**
 * Registers an eager view, typically first-party. Views take the full
 * registry props and narrow `node` themselves, returning null for other
 * kinds. Overwrites any previous entry under the id so hot reloads stay
 * consistent.
 */
export function registerView(
  id: string,
  view: ComponentType<RegistryViewProps>,
): void {
  entries.set(id, { type: "sync", view });
}

/**
 * Registers a deferred view, typically an adapter component resolved
 * from its package at build time. Loaded on first render of the id.
 */
export function registerLazyView(id: string, loader: ViewLoader): void {
  entries.set(id, { type: "lazy", loader });
}

/** Resolves a registered id, or null when nothing registered it. */
export function resolveView(id: string): RegistryEntry | null {
  return entries.get(id) ?? null;
}

/** Clears the registry; tests only. */
export function clearViews(): void {
  entries.clear();
}
