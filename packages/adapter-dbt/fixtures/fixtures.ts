import { defineFixtures } from "../../ui-fixtures/src";

export default defineFixtures({
  params: {
    runId: "7f3c1a2e",
    artifactName: "manifest.json",
    modelId: "model.analytics.orders",
  },
  resources: {
    // The cloud client returns `unknown`, so the type cannot describe a run.
    "run-detail": ({ rows }) =>
      rows === 0
        ? {}
        : {
            id: "7f3c1a2e",
            status: "success",
            resultCount: 42,
            startedAt: "2026-01-15T10:15:00Z",
          },
  },
});
