import type { DataSource } from "../../resource";
import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export interface ResourceProps {
  source: DataSource;
  content: PageNode | readonly PageNode[];
}

export interface ResourceNode {
  readonly kind: "resource";
  readonly props: ResourceProps;
}

export const Resource = defineComponent<ResourceProps, ResourceNode>({
  id: "resource",
  render: (props) => ({ kind: "resource", props: { ...props } }),
});
