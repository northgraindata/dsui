import type { DataSource } from "../../resource";
import { defineComponent } from "../define";
import type { TableRowAction, TableRowLink } from "./table";

/**
 * Which row fields fill each part of a list item. Every value names a field
 * of the row, the same way table columns and row links do.
 */
export interface ListItem {
  /** Main line, shown in bold. */
  title: string;
  /** Second line under the title. */
  description?: string;
  /** Short tag beside the title, such as a type or category. */
  badge?: string;
  /** Muted details joined after the description, such as an owner. */
  meta?: readonly string[];
  /** Icon shown before the item; an SDK icon name such as `"grid"`. */
  icon?: string;
  /** Status shown at the trailing edge, above an optional detail. */
  status?: {
    label: string;
    /**
     * Field holding a tone: healthy, warning, unavailable, info, or muted.
     * When omitted or empty, common status words in the label pick the
     * tone, so "success" is healthy and "failed" is unavailable.
     */
    tone?: string;
    /** Secondary line under the status, such as a timestamp. */
    detail?: string;
  };
}

export interface ListFilter {
  field: string;
  label: string;
  /** Choices to offer; each distinct value of the field when omitted. */
  options?: readonly { label: string; value: string }[];
}

export interface ListProps {
  source?: DataSource;
  data?: readonly Record<string, unknown>[];
  item: ListItem;
  rowLink?: TableRowLink;
  /**
   * Actions with `variant: "primary"` and an icon appear as buttons on the
   * row; the rest open from its overflow menu.
   */
  rowActions?: readonly TableRowAction[];
  /** Adds a search box that matches the title, description, badge, and meta. */
  searchable?: boolean;
  /** Singular noun for the count and search placeholder, e.g. `"job"`. */
  noun?: string;
  filters?: readonly ListFilter[];
  /** Rows shown before a "Show more" button; all rows when omitted. */
  pageSize?: number;
  emptyMessage?: string;
}

export interface ListNode {
  readonly kind: "list";
  readonly props: ListProps;
}

/** Readable rows for collections of named things: jobs, assets, runs, DAGs. */
export const List = defineComponent<ListProps>({
  id: "list",
  path: "./ui/list",
});
