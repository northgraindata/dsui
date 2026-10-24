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
  /** PostgreSQL SQL names use schema.table within the selected database. */
  omitDatabaseFromSql?: boolean;
}

export interface QueryEditorExplorerProps {
  source: DataSource;
  nameField?: string;
  typeField?: string;
  children?: QueryEditorExplorerProps;
}

export interface QueryEditorNode {
  readonly kind: "query-editor";
  readonly props: QueryEditorProps;
}

export interface QueryExplorerDocument {
  source: ResourceReference;
  nameField?: string;
  typeField?: string;
  children?: QueryExplorerDocument;
}

export const QueryEditor = defineComponent<QueryEditorProps, QueryEditorNode>({
  id: "query-editor",
  path: "./ui/query-editor",
});
