import type { DataSource } from "../../resource";
import { defineComponent } from "../define";

export interface DependencyGraphProps {
  source?: DataSource;
  data?: readonly Record<string, unknown>[];
  idField: string;
  dependsOnField: string;
  labelField?: string;
  detailField?: string;
  stateField?: string;
  rowLink?: {
    path: string;
    params: Record<string, string>;
  };
}

export interface DependencyGraphNode {
  readonly kind: "dependency-graph";
  readonly props: DependencyGraphProps;
}

export const DependencyGraph = defineComponent<
  DependencyGraphProps,
  DependencyGraphNode
>({
  id: "dependency-graph",
  render: (props) => ({ kind: "dependency-graph", props: { ...props } }),
});
