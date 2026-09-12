import type { ActionReference } from "../../action";
import { defineComponent } from "../define";
import type { PageNode } from "../nodes";
import type { FieldReference } from "./collection";

export interface PageHeaderProps {
  title: string | FieldReference;
  description?: string | FieldReference;
  icon?: string | FieldReference;
  badge?: {
    label: string | FieldReference;
    tone?: "healthy" | "warning" | "unavailable" | "info" | FieldReference;
  };
  meta?: string | FieldReference;
  variant?: "default" | "detail";
  tags?: PageNode | readonly PageNode[];
  actions?: PageNode | readonly PageNode[];
}

export interface PageHeaderNode {
  readonly kind: "page-header";
  readonly props: PageHeaderProps;
}

export type PageHeaderBadge = {
  label: string | FieldReference;
  tone?: "healthy" | "warning" | "unavailable" | "info" | FieldReference;
};

export type PageHeaderAction = {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action?: ActionReference;
  link?: string;
};

export const PageHeader = defineComponent<PageHeaderProps, PageHeaderNode>({
  id: "page-header",
  render: (props) => {
    if (!props.title) throw new Error("PageHeader requires a title");
    return { kind: "page-header", props: { ...props } };
  },
});
