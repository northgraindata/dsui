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
  /** Named action-input selectors; source inputs may reference earlier selections with $name. */
  contextSelectors?: readonly {
    name: string;
    label: string;
    source: ResourceReference;
    initialValue?: string;
    dependsOn?: readonly string[];
  }[];
}

export interface QueryEditorExplorerProps {
  source: DataSource;
  nameField?: string;
  contextKey?: string;
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
