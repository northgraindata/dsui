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

export type PageNode =
  | { kind: "page-header"; props: { title: string; description?: string } }
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
        /** Row field holding the unique node id. */
        idField: string;
        /** Row field holding the ids this node depends on. */
        dependsOnField: string;
        /** Row field rendered as the node title; defaults to `idField`. */
        labelField?: string;
        /** Row field rendered under the title, e.g. an operator name. */
        detailField?: string;
        /** Row field rendered as the node's current execution state. */
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
        /** Adapter page opened from fields in successful action data. */
        successLink?: TableRowLink;
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
      kind: "query-workbench";
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
