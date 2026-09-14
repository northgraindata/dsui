import type { DataSource, ResourceReference } from "../../resource";
import { defineComponent } from "../define";
import type { PageTableRowLink, TableRowLink } from "./table";

export interface ResourceTreeBranchProps {
  source: DataSource;
  nameField?: string;
  typeField?: string;
  rowLink?: TableRowLink;
  children?: ResourceTreeBranchProps;
}

export interface ResourceTreeProps {
  label: string;
  branch: ResourceTreeBranchProps;
  selectedPath?: string;
  stateKey?: string;
  searchPlaceholder?: string;
}

export interface ResourceTreeNode {
  readonly kind: "resource-tree";
  readonly props: ResourceTreeProps;
}

export interface ResourceTreeBranchDocument {
  source: ResourceReference;
  nameField?: string;
  typeField?: string;
  rowLink?: PageTableRowLink;
  children?: ResourceTreeBranchDocument;
}

export const ResourceTree = defineComponent<
  ResourceTreeProps,
  ResourceTreeNode
>({
  id: "resource-tree",
  render: (props) => {
    if (!props.label) throw new Error("ResourceTree requires a label");
    return { kind: "resource-tree", props: { ...props } };
  },
});
