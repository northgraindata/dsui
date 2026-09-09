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

test("a deployment URL and token are the only way to connect", async () => {
  expect(airflowAdapter.connectionMethods?.map((method) => method.id)).toEqual([
    "airflow",
  ]);
  const schema = airflowAdapter.connectionMethods?.[0]?.schema;
  expect(schema?.safeParse({}).success).toBe(false);
  expect(
    schema?.safeParse({ baseUrl: "https://airflow.example.test", token: "" })
      .success,
  ).toBe(false);
});
