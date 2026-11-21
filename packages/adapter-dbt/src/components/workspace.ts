import { defineComponent } from "@northgraindata/dsui-adapter-sdk";
export interface WorkspaceSource {
  resourceId: string;
  input?: Record<string, unknown>;
}
export const ModelCatalog = defineComponent<{ source: WorkspaceSource }>({
  id: "dbt/model-catalog",
  path: "./model-catalog-view.tsx",
});
export const ModelWorkspace = defineComponent<{
  modelId: string;
  source: WorkspaceSource;
  lineageSource: WorkspaceSource;
}>({ id: "dbt/model-workspace", path: "./model-workspace-view.tsx" });
