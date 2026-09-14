import type { ActionReference } from "@northgraindata/dsui-adapter-sdk";

export type NotebookBlockDocument =
  | { id: string; kind: "markdown"; content: string }
  | {
      id: string;
      kind: "code";
      language: string;
      content: string;
      action: ActionReference | string;
      result?: {
        columns: { name: string; type?: string }[];
        rows: Record<string, unknown>[];
        elapsedMs?: number;
        rowsChanged?: number;
      };
    };

export type NotebookDocument = {
  id?: string;
  title: string;
  description?: string;
  blocks: NotebookBlockDocument[];
  notebooks?: { id: string; title: string }[];
  openTabs?: { id: string; title: string }[];
  metadata?: {
    environment?: string;
    location?: string;
    updatedAt?: string;
    lastViewedAt?: string;
  };
  actions?: {
    save?: ActionReference | string;
    select?: ActionReference | string;
    create?: ActionReference | string;
    delete?: ActionReference | string;
    duplicate?: ActionReference | string;
    import?: ActionReference | string;
    close?: ActionReference | string;
  };
};

export type NotebookCatalogItem = {
  id: string;
  title: string;
  description?: string;
  environment?: string;
  location?: string;
  updatedAt?: string;
  lastViewedAt?: string;
};
