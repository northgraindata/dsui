import type {
  ModelDetail,
  ModelRow,
} from "../../../packages/adapter-dbt/src/components/workspace-shared";
import type { Scenario } from "./fixtures";
const names = [
  "stg_orders",
  "stg_customers",
  "int_order_items",
  "fct_orders",
  "dim_customers",
  "daily_revenue",
];
const descriptions = [
  "Cleaned order records from the commerce platform.",
  "Customer records with normalized identifiers.",
  "Order line items enriched with product and pricing data.",
  "One row per order, with totals, payment status and customer references.",
  "A customer dimension shared across revenue and retention reporting.",
  "Daily revenue by market, currency and acquisition channel.",
];
export function dbtModels(scenario: Scenario): ModelRow[] {
  if (scenario === "empty") return [];
  return Array.from({ length: scenario === "stress" ? 90 : 6 }, (_, index) => {
    const name =
      names[index % names.length] +
      (index >= names.length ? `_${index + 1}` : "");
    const schema = index % 6 < 2 ? "staging" : "marts";
    return {
      uniqueId: `model.analytics.${name}`,
      name,
      package: index % 5 === 4 ? "shared" : "analytics",
      database: "warehouse",
      schema,
      materialized:
        index % 6 < 2
          ? "view"
          : index % 6 === 3
            ? "incremental"
            : index % 6 === 5
              ? "materialized_view"
              : index % 6 === 2
                ? "ephemeral"
                : "table",
      description: descriptions[index % 6],
      location: `warehouse.${schema}`,
      upstreamLabel:
        index % 6 < 2 ? "No upstream" : `${index % 6 === 3 ? 2 : 1} upstream`,
      dependsOn:
        index % 6 < 2
          ? []
          : [
              "model.analytics.stg_orders",
              ...(index % 6 === 3 ? ["model.analytics.int_order_items"] : []),
            ],
    };
  });
}
export function dbtModelDetail(
  scenario: Scenario,
  requestedId?: string,
): ModelDetail {
  const requested = requestedId
    ? dbtModels("stress").find((model) => model.uniqueId === requestedId)
    : undefined;
  const data: ModelDetail = {
    uniqueId: "model.analytics.fct_orders",
    name: "fct_orders",
    description:
      "One row per order, with totals, payment status and customer references.",
    database: "warehouse",
    schema: "marts",
    alias: "fct_orders",
    rawCode:
      "{{ config(materialized='incremental', unique_key='order_id') }}\n\nwith orders as (\n    select * from {{ ref('stg_orders') }}\n),\nitems as (\n    select * from {{ ref('int_order_items') }}\n)\n\nselect\n    orders.order_id,\n    orders.customer_id,\n    orders.ordered_at,\n    sum(items.amount) as total_amount\nfrom orders\nleft join items using (order_id)\ngroup by 1, 2, 3",
    compiledCode:
      "select\n    orders.order_id,\n    orders.customer_id,\n    orders.ordered_at,\n    sum(items.amount) as total_amount\nfrom warehouse.staging.stg_orders as orders\nleft join warehouse.marts.int_order_items as items using (order_id)\ngroup by 1, 2, 3",
    dependencies: [
      "model.analytics.stg_orders",
      "model.analytics.int_order_items",
    ],
    columns:
      scenario === "empty"
        ? []
        : [
            {
              name: "order_id",
              dataType: "BIGINT",
              description: "Unique identifier for each order.",
            },
            {
              name: "customer_id",
              dataType: "BIGINT",
              description: "References dim_customers.customer_id.",
            },
            {
              name: "ordered_at",
              dataType: "TIMESTAMP",
              description: "Time the customer placed the order, in UTC.",
            },
            {
              name: "total_amount",
              dataType: "DECIMAL(18,2)",
              description:
                "Total order amount including adjustments and discounts.",
            },
          ],
  };
  return requested
    ? {
        ...data,
        uniqueId: requested.uniqueId,
        name: requested.name,
        description: requested.description,
        database: requested.database,
        schema: requested.schema,
        alias: requested.name,
        dependencies: requested.dependsOn,
      }
    : data;
}
