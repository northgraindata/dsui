declare module "virtual:dsui-adapters" {
  export const adapterPages: {
    adapter: string;
    name: string;
    path: string;
    source: string;
    nodes: import("@northgraindata/dsui-adapter-sdk").PageNode[];
  }[];
}
