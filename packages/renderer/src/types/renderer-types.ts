import type {
  ActionReference,
  PageNode,
  ResourceReference,
} from "@northgraindata/dsui-adapter-sdk";

export interface RendererClient {
  /** Already-public connection details for presentation; never credentials. */
  connection?: { name: string; endpoint: string };
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
  /** Plugin pages dispatch namespaced host procedures rather than adapter actions. */
  executePluginProcedure?(
    procedureId: string,
    input: unknown,
  ): Promise<unknown>;
  /** Navigate to an adapter page path, e.g. "/databases/memory". */
  navigate(path: string): void;
}

export interface DeclarativePageRendererProps {
  client: RendererClient;
  nodes: readonly PageNode[];
}
