import { expect, test } from "bun:test";
import airflow from "../packages/adapter-airflow/src/index";
import bigquery from "../packages/adapter-bigquery/src/index";
import clickhouse from "../packages/adapter-clickhouse/src/index";
import dagster from "../packages/adapter-dagster/src/index";
import databricks from "../packages/adapter-databricks/src/index";
import dbtCloud from "../packages/adapter-dbt-cloud/src/index";
import kafka from "../packages/adapter-kafka/src/index";
import mock from "../packages/adapter-mock/src/index";
import polaris from "../packages/adapter-polaris/src/index";
import postgres from "../packages/adapter-postgres/src/index";
import redshift from "../packages/adapter-redshift/src/index";
import s3 from "../packages/adapter-s3/src/index";
import snowflake from "../packages/adapter-snowflake/src/index";
import { checkAdapter } from "../packages/adapter-test/src/index";
import trino from "../packages/adapter-trino/src/index";

const adapters = [
  { adapter: kafka, connection: { brokers: ["localhost:9092"] } },
  { adapter: s3, connection: { endpoint: "http://localhost:9000" } },
  { adapter: trino, connection: { host: "localhost", username: "dsui" } },
  {
    adapter: clickhouse,
    connection: { host: "localhost", username: "default" },
  },
  {
    adapter: polaris,
    connection: { baseUrl: "http://localhost:8181", catalog: "default" },
  },
  {
    adapter: snowflake,
    connection: { accountIdentifier: "org-account", token: "token" },
  },
  {
    adapter: bigquery,
    connection: { projectId: "project", accessToken: "token" },
  },
  { adapter: airflow, connection: { baseUrl: "http://localhost:8080" } },
  {
    adapter: redshift,
    connection: { host: "localhost", username: "dsui", password: "secret" },
  },
  { adapter: postgres, connection: { host: "localhost" } },
  {
    adapter: databricks,
    connection: {
      workspaceUrl: "https://example.cloud.databricks.com",
      token: "token",
      warehouseId: "warehouse",
    },
  },
  { adapter: dagster, connection: { baseUrl: "http://localhost:3000" } },
  { adapter: dbtCloud, connection: { accountId: 1, token: "token" } },
  { adapter: mock, connection: {} },
];

for (const { adapter, connection } of adapters) {
  test(`${adapter.id} implements the adapter contract`, async () => {
    const results = await checkAdapter(adapter, connection);
    expect(results).toEqual(
      expect.arrayContaining([expect.objectContaining({ ok: true })]),
    );
    expect(results.every((result) => result.ok)).toBe(true);
  });
}
