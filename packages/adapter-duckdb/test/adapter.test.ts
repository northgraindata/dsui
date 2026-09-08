import { expect, test } from "bun:test";
import {
  createAdapterInstance,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import duckdbAdapter, { runQuery, tables } from "../src/adapter.js";

test("the mock DuckDB adapter exposes seeded tables and runs a preview query", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, {
    database: ":memory:",
  });

  const catalog = await instance.executeResource(tables());
  expect(catalog).toEqual({
    status: "success",
    data: [
      { name: "customers", rows: 3, type: "TABLE" },
      { name: "orders", rows: 4, type: "TABLE" },
    ],
  });

  const result = await instance.executeAction(
    runQuery({ sql: "SELECT * FROM orders LIMIT 2" }),
  );
  expect(result).toEqual({
    status: "success",
    data: {
      columns: ["id", "customer", "amount", "status"],
      rows: [
        { id: 1001, customer: "Ada Lovelace", amount: 129.5, status: "paid" },
        { id: 1002, customer: "Grace Hopper", amount: 89, status: "pending" },
      ],
    },
  });

  await instance.dispose();
});

test("the query editor page stays within the serializable page protocol", async () => {
  const instance = await createAdapterInstance(duckdbAdapter, {
    database: ":memory:",
  });
  const scope = instance.createPageScope("/query");
  const nodes = scope.render();
  const list = Array.isArray(nodes) ? nodes : [nodes];

  expect(list.map((node) => node.kind)).toEqual([
    "page-header",
    "form",
    "table",
  ]);
  const form = list[1];
  expect(form?.kind).toBe("form");
  if (form?.kind === "form") {
    expect(form.props.onSubmit.id).toBe("run-query");
    expect(form.props.fields[0]?.kind).toBe("text-input");
  }
  const serialized = serializeNodes(list);
  const serializedForm = serialized[1];
  expect(serializedForm?.kind).toBe("form");
  if (serializedForm?.kind === "form")
    expect(serializedForm.props.action.actionId).toBe("run-query");

  scope.dispose();
  await instance.dispose();
});
