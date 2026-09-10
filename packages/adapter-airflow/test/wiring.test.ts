import { expect, spyOn, test } from "bun:test";
import { createAdapterInstance } from "@northgraindata/dsui-adapter-sdk";
import { airflowAdapter } from "../src/adapter.js";
import { dags } from "../src/resources/dags.js";

test("default adapter reads Airflow instead of fixture data", async () => {
  const http = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      dags: [
        {
          dag_id: "real_dag",
          dag_display_name: "Real DAG",
          is_paused: false,
          is_stale: false,
          description: null,
          timetable_summary: "@daily",
          last_parsed_time: null,
          owners: ["airflow"],
          tags: [],
        },
      ],
      total_entries: 1,
    }),
  );
  const instance = await createAdapterInstance(airflowAdapter, {
    method: "airflow",
    baseUrl: "https://airflow.example.test",
    token: "fixture-token",
  });
  try {
    const result = await instance.executeResource(dags());
    expect(result).toMatchObject({
      status: "success",
      data: [{ dagId: "real_dag" }],
    });
    expect(http).toHaveBeenCalledTimes(1);
    const [input, init] = http.mock.calls[0] ?? [];
    expect(String(input)).toBe(
      "https://airflow.example.test/api/v2/dags?limit=100&offset=0&order_by=dag_id",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer fixture-token",
    );
  } finally {
    await instance.dispose();
    http.mockRestore();
  }
});

test("Airflow 2 connections wire the v1 API and basic authentication", async () => {
  const http = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ dags: [], total_entries: 0 }),
  );
  const instance = await createAdapterInstance(airflowAdapter, {
    method: "airflow-2",
    baseUrl: "https://airflow.example.test",
    username: "airflow-user",
    password: "secret-password",
  });
  try {
    expect(await instance.executeResource(dags())).toEqual({
      status: "success",
      data: [],
    });
    const [input, init] = http.mock.calls[0] ?? [];
    expect(String(input)).toBe(
      "https://airflow.example.test/api/v1/dags?limit=100&offset=0&order_by=dag_id",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Basic ${btoa("airflow-user:secret-password")}`,
    );
  } finally {
    await instance.dispose();
    http.mockRestore();
  }
});

test("offers version-specific Airflow connection methods", async () => {
  expect(airflowAdapter.connectionMethods?.map((method) => method.id)).toEqual([
    "airflow",
    "airflow-2",
  ]);
  const airflow3Schema = airflowAdapter.connectionMethods?.[0]?.schema;
  const airflow2Schema = airflowAdapter.connectionMethods?.[1]?.schema;
  expect(airflow3Schema?.safeParse({}).success).toBe(false);
  expect(
    airflow3Schema?.safeParse({
      baseUrl: "https://airflow.example.test",
      token: "",
    }).success,
  ).toBe(false);
  expect(
    airflow2Schema?.safeParse({
      baseUrl: "https://airflow.example.test",
      username: "airflow",
      password: "airflow",
    }).success,
  ).toBe(true);
  expect(
    airflowAdapter.connectionSchema?.safeParse({
      method: "airflow-2",
      baseUrl: "https://airflow.example.test",
      username: "airflow",
      password: "",
    }).success,
  ).toBe(false);
});
