import type { ReactNode } from "react";
import type { ActionReference } from "../action";
import type { ResourceReference } from "../resource";
import type { PageNode } from "./nodes";

/** Minimal browser-safe client contract available to component implementations. */
export interface ComponentClient {
  executeResource(reference: ResourceReference): Promise<unknown>;
  watchResource?(
    reference: ResourceReference,
    listener: (value: unknown) => void,
  ): () => void;
  executeAction(
    reference: ActionReference,
  ): Promise<
    | { status: "success"; data?: unknown }
    | { status: "error"; message?: string }
  >;
  navigate(path: string): void;
}

/** Props shared by every browser component implementation. */
export interface ComponentProps {
  client: ComponentClient;
  node: PageNode;
  renderNode: (
    client: ComponentClient,
    node: PageNode,
    context?: Record<string, unknown>,
  ) => ReactNode;
  context?: Record<string, unknown>;
}

export function componentProps<T>(node: PageNode): T | undefined {
  if (node.kind !== "custom") return undefined;
  return node.props.props as T | undefined;
}
