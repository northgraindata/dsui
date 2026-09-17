import type { ActionReference, AnyActionDefinition } from "../../action";
import type { DataSource, ResourceReference } from "../../resource";
import { defineComponent } from "../define";

export interface QueryEditorProps {
  language: string;
  value?: string;
  action: AnyActionDefinition | ActionReference | string;
  database?: {
    source: DataSource;
    initialValue?: string;
    label?: string;
  };
  explorer?: QueryEditorExplorerProps;
}

export interface QueryEditorExplorerProps {
  source: DataSource;
  nameField?: string;
  children?: QueryEditorExplorerProps;
}

export interface QueryEditorNode {
  readonly kind: "query-editor";
  readonly props: QueryEditorProps;
}

export interface QueryExplorerDocument {
  source: ResourceReference;
  nameField?: string;
  children?: QueryExplorerDocument;
}

export const QueryEditor = defineComponent<QueryEditorProps, QueryEditorNode>({
  id: "query-editor",
  path: "./ui/query-editor",
});
