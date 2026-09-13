import type { ActionReference } from "@northgraindata/dsui-adapter-sdk";

export type NotebookBlockDocument =
  | { id: string; kind: "markdown"; content: string }
  | {
      id: string;
      kind: "code";
      language: string;
      content: string;
      action: ActionReference | string;
    };

export type NotebookDocument = {
  title: string;
  description?: string;
  blocks: NotebookBlockDocument[];
};
