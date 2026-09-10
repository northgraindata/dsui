/** Browser-safe, serialized description of an adapter page. */
export interface PageDocument {
  path: string;
  nodes: readonly PageNode[];
}

export type ResourceReference = {
  resourceId: string;
  input?: unknown;
  /** Present only for resources that should refresh while rendered. */
  refresh?: { kind: "poll"; intervalMs: number };
};

export type ActionReference = {
  actionId: string;
  input?: unknown;
};

/** Renderer-owned visual cue for an action; never an asset or markup payload. */
export type ActionIcon = "play" | "pause" | "resume" | "retry" | "clear";

export interface QueryExplorerDocument {
  source: ResourceReference;
  nameField?: string;
  children?: QueryExplorerDocument;
}

export interface ResourceTreeBranchDocument {
  source: ResourceReference;
  nameField?: string;
  typeField?: string;
  rowLink?: TableRowLink;
  children?: ResourceTreeBranchDocument;
}

export type TableRowLink = {
  /** Adapter page path with :param placeholders, e.g. "/databases/:database". */
  path: string;
  /** URL param name -> row field name; values are URL-encoded on render. */
  params: Record<string, string>;
};

export type TableRowAction = {
  label: string;
  icon?: ActionIcon;
  variant?: "primary" | "secondary" | "danger";
  /** Action id plus input template (action-input field -> row field). */
  action: {
    actionId: string;
    input?: Record<string, string>;
  };
  /** Adapter page opened from fields in successful action data. */
  successLink?: TableRowLink;
  /** Show only when the row matches every present clause. */
  when?: {
    field: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  };
};

export type PageHeaderBadge = {
  label: string;
  tone?: "healthy" | "warning" | "unavailable" | "info";
};

export type PageHeaderAction = {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action?: ActionReference;
  /** Adapter page path; mutually exclusive with `action`. */
  link?: string;
};

export type StatGridItem = {
  /** Icon id; the renderer falls back to a default glyph when unknown. */
  icon?: string;
  /** Record field read for the value. */
  field: string;
  /** Label under the value. */
  label: string;
};

export type SectionLink = {
  label: string;
  /** Adapter page path. */
  path: string;
};

export type OverviewCard = {
  title: string;
  description?: string;
  badge?: string;
  badgeTone?: "healthy" | "warning" | "unavailable" | "info";
  icon?: string;
  /** Short detail lines rendered under the description. */
  meta?: readonly string[];
  link?: TableRowLink;
};

export type ActionListItem = {
  icon?: string;
  title: string;
  description?: string;
  /** Keyboard hint rendered beside the item; display only. */
  kbd?: string;
  /** Adapter page path; mutually exclusive with `action`. */
  link?: string;
  action?: ActionReference;
};

export type MeterSegment = {
  label: string;
  /** Segment size in bytes; must be finite and non-negative. */
  value: number;
  tone?: "info" | "healthy" | "warning" | "unavailable" | "muted" | "deep";
  /** Hide from the legend (still rendered in the bar); defaults to true. */
  legend?: boolean;
};

export type MeterData = {
  segments: readonly MeterSegment[];
  footer?: string;
};

export type PageNode =
  | {
      kind: "custom";
      props: {
        /** Registry id, e.g. `"duckdb/table-card"`. */
        component: string;
        /** JSON-serializable props for the component. */
        props?: Record<string, unknown>;
      };
    }
  | {
      kind: "entity-catalog";
      props: {
        source: ResourceReference;
        title: string;
        subtitle?: string;
        description?: string;
        icon?: string;
        filters?: import("./entity-document").CatalogFilter[];
        createLabel?: string;
        searchPlaceholder?: string;
      };
    }
  | { kind: "entity-detail"; props: { source: ResourceReference } }
  | {
      kind: "page-header";
      props: {
        title: string;
        description?: string;
        badge?: PageHeaderBadge;
        /** Secondary line under the description, e.g. a file path. */
        meta?: string;
        actions?: readonly PageHeaderAction[];
      };
    }
  | {
      kind: "table";
      props: {
        source?: ResourceReference;
        data?: readonly unknown[];
        columns?: readonly { id: string; label: string }[];
        rowLink?: TableRowLink;
        rowActions?: readonly TableRowAction[];
      };
    }
  | {
      kind: "dependency-graph";
      props: {
        source?: ResourceReference;
        data?: readonly unknown[];
        idField: string;
        dependsOnField: string;
        labelField?: string;
        detailField?: string;
        stateField?: string;
        rowLink?: TableRowLink;
      };
    }
  | {
      kind: "button";
      props: {
        label: string;
        icon?: ActionIcon;
        variant?: "primary" | "secondary" | "danger";
        action?: ActionReference;
        /** Adapter page path; mutually exclusive with `action`. */
        link?: string;
        /** Adapter page opened from fields in successful action data. */
        successLink?: TableRowLink;
      };
    }
  | {
      kind: "stat-grid";
      props: {
        source?: ResourceReference;
        data?: Record<string, unknown>;
        items: readonly StatGridItem[];
      };
    }
  | {
      kind: "section";
      props: {
        title: string;
        description?: string;
        link?: SectionLink;
        content: readonly PageNode[];
      };
    }
  | {
      kind: "card-list";
      props: {
        source?: ResourceReference;
        cards?: readonly OverviewCard[];
        /** Fixed column count (1-4); defaults to a fluid fit. */
        columns?: number;
      };
    }
  | {
      kind: "action-list";
      props: {
        items: readonly ActionListItem[];
      };
    }
  | {
      kind: "columns";
      props: {
        columns: readonly {
          weight?: number;
          content: readonly PageNode[];
        }[];
      };
    }
  | {
      kind: "meter";
      props: {
        source?: ResourceReference;
        data?: MeterData;
      };
    }
  | {
      kind: "tabs";
      props: {
        items: readonly { label: string; content: readonly PageNode[] }[];
      };
    }
  | {
      kind: "key-value";
      props: {
        title?: string;
        source?: ResourceReference;
        data?: Record<string, unknown>;
      };
    }
  | {
      kind: "query-editor";
      props: {
        language: string;
        value?: string;
        action: ActionReference;
        explorer?: QueryExplorerDocument;
      };
    }
  | {
      kind: "resource-tree";
      props: {
        label: string;
        branch: ResourceTreeBranchDocument;
        selectedPath?: string;
        stateKey?: string;
        searchPlaceholder?: string;
      };
    }
  | {
      kind: "split-pane";
      props: {
        sidebar: readonly PageNode[];
        content: readonly PageNode[];
        inspector?: readonly PageNode[];
      };
    }
  | {
      kind: "select";
      props: {
        name: string;
        label?: string;
        options: readonly { label: string; value: string }[];
        value?: string | null;
        placeholder?: string;
      };
    }
  | {
      kind: "text-input";
      props: {
        name: string;
        label?: string;
        value?: string;
        placeholder?: string;
        secret?: boolean;
      };
    }
  | {
      kind: "form";
      props: {
        fields: readonly PageNode[];
        action: ActionReference;
        submitLabel?: string;
      };
    };
