import { defineComponent } from "../define";
import type { DataSource } from "../../resource";
import type { PageNode } from "../nodes";

export interface FieldReference {
  field: string;
}

export interface CollectionProps {
  source?: DataSource;
  field?: string;
  content: PageNode | readonly PageNode[];
}

export interface CollectionNode {
  readonly kind: "collection";
  readonly props: CollectionProps;
}

export const Collection = defineComponent<CollectionProps, CollectionNode>({
  id: "collection",
  render: (props) => {
    if (!props.source && !props.field)
      throw new Error("Collection requires a source or context field");
    return { kind: "collection", props: { ...props } };
  },
});
