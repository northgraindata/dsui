import { defineComponent } from "@northgraindata/dsui-adapter-sdk";

export interface DependencyGraphProps {
  source?: {
    resourceId: string;
    input?: Record<string, unknown>;
  };
  idField: string;
  dependsOnField: string;
  labelField?: string;
  detailField?: string;
  stateField?: string;
  rowLink?: { path: string; params: Record<string, string> };
}

export const DependencyGraph = defineComponent<DependencyGraphProps>({
  id: "dbt/dependency-graph",
  path: "./dependency-graph-view.tsx",
});
