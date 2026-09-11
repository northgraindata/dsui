import type { AnyActionDefinition } from "../../action";
import type { DataSource } from "../../resource";
import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export interface TableColumn {
  id: string;
  label: string;
  renderCell?: PageNode | readonly PageNode[];
}

export interface TableRowLink {
  path: string;
  params: Record<string, string>;
}

export interface TableRowAction {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action: AnyActionDefinition | string;
  input?: Record<string, string>;
  confirmation?: {
    title: string;
    description: string;
    confirmLabel?: string;
  };
  when?: {
    field: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  };
  disabledWhen?: {
    field: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  };
}

export interface TableRowMenuAction {
  label: string;
  action?: AnyActionDefinition | string;
  input?: Record<string, string>;
  link?: TableRowLink;
  confirmation?: {
    title: string;
    description: string;
    confirmLabel?: string;
  };
  when?: {
    field: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  };
}

export type PageTableRowLink = {
  path: string;
  params: Record<string, string>;
};

export type PageTableRowAction = {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action: {
    actionId: string;
    input?: Record<string, string>;
  };
  successLink?: PageTableRowLink;
  confirmation?: {
    title: string;
    description: string;
    confirmLabel?: string;
  };
  when?: {
    field: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  };
  disabledWhen?: {
    field: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  };
};

export interface TableProps {
  source?: DataSource;
  columnsSource?: DataSource;
  data?: readonly Record<string, unknown>[];
  columns?: readonly TableColumn[];
  variant?: "default" | "data";
  rowLink?: TableRowLink;
  rowActions?: readonly TableRowAction[];
  actions?: readonly TableRowMenuAction[];
}

export interface TableNode {
  readonly kind: "table";
  readonly props: TableProps;
}

export const Table = defineComponent<TableProps, TableNode>({
  id: "table",
  render: (props) => {
    if (props.rowLink && !props.rowLink.path.startsWith("/"))
      throw new Error("Table rowLink path must be absolute");
    for (const action of props.actions ?? []) {
      if (Boolean(action.action) === Boolean(action.link))
        throw new Error("Table action requires exactly one action or link");
      if (action.link && !action.link.path.startsWith("/"))
        throw new Error("Table action link path must be absolute");
    }
    return { kind: "table", props: { ...props } };
  },
});
