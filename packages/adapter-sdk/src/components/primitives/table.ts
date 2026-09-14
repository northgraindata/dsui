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
  icon?: string;
  variant?: "primary" | "secondary" | "danger";
  action?: AnyActionDefinition | string;
  link?: TableRowLink;
  input?: Record<string, string>;
  successLink?: TableRowLink;
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
  successLink?: TableRowLink;
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

export interface TableFilter {
  field: string;
  label: string;
  options: readonly { label: string; value: string }[];
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
  searchable?: boolean;
  filters?: readonly TableFilter[];
  pageSize?: number;
}

export interface TableNode {
  readonly kind: "table";
  readonly props: TableProps;
}

export const Table = defineComponent<TableProps>({
  id: "table",
  path: "./ui/table",
});
