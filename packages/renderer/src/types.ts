import type {
  ActionReference,
  PageNode,
  ResourceReference,
} from "@northgraindata/dsui-core";

export interface RendererClient {
  executeResource(reference: ResourceReference): Promise<unknown>;
  executeAction(
    reference: ActionReference,
  ): Promise<{ status: "success" | "error"; message?: string }>;
}

export interface DeclarativePageRendererProps {
  client: RendererClient;
  nodes: readonly PageNode[];
}
