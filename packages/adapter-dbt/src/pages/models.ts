import { definePage, Target } from "@northgraindata/dsui-adapter-sdk";
import { ModelCatalog } from "../components/workspace.js";
import { models } from "../resources/artifacts.js";
export const modelsPage = definePage({
  path: "/models",
  render: () =>
    Target({
      id: "dbt.models.table",
      content: ModelCatalog({ source: models() }),
    }),
});
