import { defineFixtures } from "../../ui-fixtures/src";

export default defineFixtures({
  params: {
    database: "analytics",
    schema: "public",
    relation: "orders",
  },
});
