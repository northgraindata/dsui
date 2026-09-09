import type {
  ActionReference,
  PageNode,
  ResourceReference,
} from "@northgraindata/dsui-core";

export interface RendererClient {
  executeResource(reference: ResourceReference): Promise<unknown>;
  executeAction(
    reference: ActionReference,
  ): Promise<
    | { status: "success"; data?: unknown }
    | { status: "error"; message?: string }
  >;
  /** Navigate to an adapter page path, e.g. "/databases/memory". */
  navigate(path: string): void;
}

export interface DeclarativePageRendererProps {
  client: RendererClient;
  nodes: readonly PageNode[];
}
