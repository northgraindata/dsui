import {
  createAdapterEmulator,
  resetAdapterEmulators,
} from "@northgraindata/dsui-adapter-mock";
import { expect, test } from "vitest";
import { AdapterRegistry, endpointFor } from "../src/adapters";

test("registers every first-party adapter", () => {
  const ids = new AdapterRegistry().list().map((adapter) => adapter.id);
  for (const id of [
    "snowflake",
    "bigquery",
    "kafka",
    "airflow",
    "redshift",
    "postgres",
    "databricks",
    "dagster",
    "dbt-cloud",
    "mock",
  ])
    expect(ids).toContain(id);
});

test("emulates every Snowflake capability without Snowflake credentials", async () => {
  resetAdapterEmulators();
  const adapter = new AdapterRegistry().get("snowflake");
  const instance = createAdapterEmulator(adapter, "snowflake-test", {
    now: () => new Date("2026-01-01T00:00:00Z"),
  });
  for (const capability of adapter.capabilities)
    await expect(instance.execute(capability.id, {})).resolves.toBeDefined();

  const before = (await instance.execute("query", { sql: "SELECT 1" })) as {
    items: unknown[];
  };
  await instance.execute("query", {
    sql: "INSERT INTO customers VALUES ('mock')",
  });
  const after = (await instance.execute("query", { sql: "SELECT 1" })) as {
    items: unknown[];
  };
  expect(after.items).toHaveLength(before.items.length + 1);
});

test("uses service-shaped mutable Airflow and dbt Cloud fixtures", async () => {
  resetAdapterEmulators();
  const registry = new AdapterRegistry();
  const airflow = createAdapterEmulator(
    registry.get("airflow"),
    "airflow-test",
  );
  const dags = (await airflow.execute("dags", {})) as {
    items: Array<{ dag_id: string }>;
  };
  expect(dags.items[0]?.dag_id).toBe("customer_daily");
  const runsBefore = (await airflow.execute("dag-runs", {})) as {
    items: unknown[];
  };
  await airflow.execute("trigger-dag", { dagId: "customer_daily" });
  const runsAfter = (await airflow.execute("dag-runs", {})) as {
    items: unknown[];
  };
  expect(runsAfter.items).toHaveLength(runsBefore.items.length + 1);

  const dbt = createAdapterEmulator(registry.get("dbt-cloud"), "dbt-test");
  const projects = (await dbt.execute("projects", {})) as {
    items: Array<{ name: string }>;
  };
  expect(projects.items[0]?.name).toBe("Analytics");
});

test("emulates every declared capability for every selectable service", async () => {
  resetAdapterEmulators();
  const registry = new AdapterRegistry();
  for (const adapter of registry.list().filter((item) => item.id !== "mock")) {
    const instance = createAdapterEmulator(adapter, `${adapter.id}-all`);
    for (const capability of adapter.capabilities)
      await expect(instance.execute(capability.id, {})).resolves.toBeDefined();
  }
});

test("formats endpoints without exposing credentials", () => {
  expect(
    endpointFor("snowflake", {
      accountIdentifier: "org-account",
      token: "secret",
    }),
  ).toBe("org-account.snowflakecomputing.com");
  expect(
    endpointFor("postgres", {
      host: "postgres",
      port: 5432,
      password: "secret",
    }),
  ).toBe("postgres:5432");
  expect(
    endpointFor("mock", { serviceType: "airflow", preset: "incident" }),
  ).toBe("mock://airflow/incident");
});
