import { defineComponent } from "../define";
import type { AnyActionDefinition } from "../../action";
import type { DataSource } from "../../resource";
import type { ResourceReference } from "../../resource";

export interface QueryEditorProps {
  language: string;
  value?: string;
  action: AnyActionDefinition | string;
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
  render: (props) => {
    if (!props.language) throw new Error("QueryEditor requires a language");
    return { kind: "query-editor", props: { ...props } };
  },
});
