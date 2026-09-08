/** Browser-safe, serialized description of an adapter page. */
export interface PageDocument {
  path: string;
  nodes: readonly PageNode[];
}

export type ResourceReference = {
  resourceId: string;
  input?: unknown;
};

export type ActionReference = {
  actionId: string;
  input?: unknown;
};

export type PageNode =
  | { kind: "page-header"; props: { title: string; description?: string } }
  | {
      kind: "table";
      props: {
        source?: ResourceReference;
        data?: readonly unknown[];
        columns?: readonly { id: string; label: string }[];
      };
    }
  | {
      kind: "button";
      props: {
        label: string;
        variant?: "primary" | "secondary" | "danger";
        action?: ActionReference;
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
