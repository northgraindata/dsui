import type { DataSource } from "@northgraindata/dsui-adapter-sdk";
import { defineComponent } from "@northgraindata/dsui-adapter-sdk";

export interface DependencyGraphProps {
  source?: DataSource;
  data?: readonly Record<string, unknown>[];
  idField: string;
  dependsOnField: string;
  labelField?: string;
  detailField?: string;
  stateField?: string;
  rowLink?: { path: string; params: Record<string, string> };
}

/** Airflow's graph is a browser component, not an SDK primitive. */
export const DependencyGraph = defineComponent<DependencyGraphProps>({
  id: "airflow/dependency-graph",
  path: "./dependency-graph.tsx",
});
