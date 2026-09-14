import type { ActionTarget } from "../../action";
import { defineComponent } from "../define";

export type NotebookBlock =
  | { id: string; kind: "markdown"; content: string }
  | {
      id: string;
      kind: "code";
      language: string;
      content: string;
      action: ActionTarget | string;
      result?: {
        columns: { name: string; type?: string }[];
        rows: Record<string, unknown>[];
        elapsedMs?: number;
        rowsChanged?: number;
      };
    };

export interface NotebookProps {
  id?: string;
  title: string;
  description?: string;
  blocks: readonly NotebookBlock[];
  notebooks?: readonly { id: string; title: string }[];
  openTabs?: readonly { id: string; title: string }[];
  metadata?: {
    environment?: string;
    location?: string;
    updatedAt?: string;
    lastViewedAt?: string;
  };
  actions?: {
    save?: ActionTarget | string;
    select?: ActionTarget | string;
    create?: ActionTarget | string;
    delete?: ActionTarget | string;
    duplicate?: ActionTarget | string;
    import?: ActionTarget | string;
    close?: ActionTarget | string;
  };
}

export interface NotebookNode {
  readonly kind: "notebook";
  readonly props: NotebookProps;
}

export const Notebook = defineComponent<NotebookProps, NotebookNode>({
  id: "notebook",
  path: "./ui/notebook",
});
