declare module "virtual:dsui-pro" {
  export const available: boolean;
  export const ProView: import("react").ComponentType<{
    view: string;
    state: string;
    fixtures: ReturnType<typeof import("./pro-fixtures").proFixtures>;
    client: import("@northgraindata/dsui-renderer").RendererClient;
    renderNode: (
      client: import("@northgraindata/dsui-renderer").RendererClient,
      node: import("@northgraindata/dsui-adapter-sdk").PageNode,
    ) => import("react").ReactNode;
    onDone: () => void;
  }>;
}
declare module "virtual:dsui-pro-suite" {
  export const available: boolean;
  export const ProPluginView: import("react").ComponentType<{
    plugin: string;
    view: string;
    client: import("@northgraindata/dsui-renderer").RendererClient;
    renderNode: (
      client: import("@northgraindata/dsui-renderer").RendererClient,
      node: import("@northgraindata/dsui-adapter-sdk").PageNode,
    ) => import("react").ReactNode;
  }>;
}
