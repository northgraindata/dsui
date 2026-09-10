import { expect, test } from "bun:test";
import { z } from "zod";
import { defineComponent } from "./custom";
import { serializeNodes } from "./serialize";

test("defineComponent path mode returns a custom node", () => {
  const TableCard = defineComponent<{ table: string }>({
    id: "duckdb/table-card",
    path: "./components/TableCard.tsx",
  });
  expect(TableCard({ table: "orders" })).toEqual({
    kind: "custom",
    props: { component: "duckdb/table-card", props: { table: "orders" } },
  });
  expect(TableCard.kind).toBe("component");
  expect(TableCard.id).toBe("duckdb/table-card");
});

test("defineComponent requires exactly one of render and path", () => {
  const bad = (options: unknown) => () => defineComponent(options as never);
  expect(bad({ id: "x", path: "./X.tsx", render: () => [] })).toThrow();
  expect(bad({ id: "x", path: "" })).toThrow();
  expect(bad({ id: "" })).toThrow();
});

test("defineComponent validates props against the schema", () => {
  const Card = defineComponent<{ table: string; limit?: number }>({
    id: "duckdb/table-card",
    path: "./components/TableCard.tsx",
    props: z.object({ table: z.string(), limit: z.number().default(100) }),
  });
  expect(Card({ table: "orders" })).toMatchObject({
    kind: "custom",
    props: {
      component: "duckdb/table-card",
      props: { table: "orders", limit: 100 },
    },
  });
  expect(() => Card({ table: 42 as unknown as string })).toThrow();
});

test("custom nodes serialize to component references", () => {
  const TableCard = defineComponent<{ table: string }>({
    id: "duckdb/table-card",
    path: "./components/TableCard.tsx",
  });
  expect(serializeNodes([TableCard({ table: "orders" })])).toEqual([
    {
      kind: "custom",
      props: { component: "duckdb/table-card", props: { table: "orders" } },
    },
  ]);
});
