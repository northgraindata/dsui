import { expect, test } from "bun:test";
import type { Adapter } from "../../api";
import { filterAdapterCatalog } from "./catalog-filter";

const adapters: Adapter[] = [
  {
    id: "warehouse",
    name: "Warehouse",
    category: "Databases",
    description: "Analytical data",
    fields: [],
    presentation: {
      features: [{ title: "SQL workspace", description: "Run queries" }],
    },
  },
  {
    id: "scheduler",
    name: "Scheduler",
    category: "Orchestration",
    description: "Pipeline runs",
    fields: [],
  },
  {
    id: "legacy",
    name: "Legacy adapter",
    category: "Other",
    description: "",
    fields: [],
  },
];
test("search matches all words across identity and declared capabilities, without depending on adapter ids", () => {
  expect(
    filterAdapterCatalog(adapters, "  WAREHOUSE sql ", null).map(
      (adapter) => adapter.id,
    ),
  ).toEqual(["warehouse"]);
  expect(
    filterAdapterCatalog(adapters, "pipeline", null).map(
      (adapter) => adapter.id,
    ),
  ).toEqual(["scheduler"]);
  expect(filterAdapterCatalog(adapters, "sql", "Orchestration")).toEqual([]);
});
test("category filtering and empty search preserve legacy adapters without presentation metadata", () => {
  expect(
    filterAdapterCatalog(adapters, "", "Other").map((adapter) => adapter.id),
  ).toEqual(["legacy"]);
  expect(filterAdapterCatalog(adapters, "  ", null)).toEqual(adapters);
});

test("legacy HTTP adapters keep their connection form without invented catalog content", async () => {
  const { adapterFromPublicAdapter } = await import("../../api");
  const legacy = adapterFromPublicAdapter({
    id: "legacy",
    name: "Legacy adapter",
    description: "Existing connection.",
    status: "ok",
    resources: [{ id: "run-query" }],
    actions: [],
    pages: [],
    components: [],
    connectionMethods: [
      {
        id: "api",
        label: "API",
        schema: {
          type: "object",
          properties: { token: { type: "string" } },
          required: ["token"],
        },
      },
    ],
  });
  expect(legacy.category).toBe("Other");
  expect(legacy.presentation).toBeUndefined();
  expect(legacy.description).toBe("Existing connection.");
  expect(legacy.connectionMethods?.[0]?.fields[0]?.key).toBe("token");
});
