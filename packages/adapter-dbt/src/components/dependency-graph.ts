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

// The browser renderer reuses the interactive graph implementation used by Airflow.
export const DependencyGraph = defineComponent<DependencyGraphProps>({
  id: "airflow/dependency-graph",
  path: "./dependency-graph.tsx",
});
