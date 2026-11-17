import { definePage, Target } from "@northgraindata/dsui-adapter-sdk";
import { ModelWorkspace } from "../components/workspace.js";
import { modelDetail, modelLineage } from "../resources/artifacts.js";
export const modelDetailPage = definePage({
  path: "/models/:modelId",
  render: ({ params }) =>
    Target({
      id: "dbt.model.source",
      content: ModelWorkspace({
        modelId: params.modelId,
        source: modelDetail({ modelId: params.modelId }),
        lineageSource: modelLineage({ modelId: params.modelId }),
      }),
    }),
});
