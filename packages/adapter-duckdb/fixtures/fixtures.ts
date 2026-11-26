import { defineFixtures } from "../../ui-fixtures/src";

export default defineFixtures({
  params: {
    database: "analytics",
    schema: "main",
    relationType: "table",
    relation: "orders",
    notebookId: "revenue",
    extension: "httpfs",
  },
});
