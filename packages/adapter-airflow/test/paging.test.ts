import { describe, expect, test } from "bun:test";
import { createAirflowClient } from "../src/client";
import type { AirflowClient } from "../src/context";
import { fakeAirflow, TOTAL } from "./fake-airflow";

function connect(apiVersion: "v1" | "v2") {
  const server = fakeAirflow();
  const client: AirflowClient = createAirflowClient(
    {
      baseUrl: "http://airflow.test",
      username: "user",
      password: "password",
      apiVersion,
    },
    server.fetchFn,
  );
  return { client, requests: server.requests };
}
const first = { limit: 25, offset: 0, search: "" };

describe.each(["v1", "v2"] as const)("lists over API %s", (version) => {
  test("the event log starts with the newest of all events", async () => {
    const { client, requests } = connect(version);
    const page = await client.listEventLogPage(first);
    expect(page.total).toBe(TOTAL);
    expect(page.items).toHaveLength(25);
    expect(page.items[0]?.eventLogId).toBe(String(TOTAL));
    expect(requests[0]?.searchParams.get("order_by")).toBe("-when");
  });

  test("records past the first hundred are reachable, one request a page", async () => {
    const { client, requests } = connect(version);
    const page = await client.listConnectionPage({ ...first, offset: 225 });
    expect(page.items.map((item) => item.connectionId).at(-1)).toBe("conn_250");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.searchParams.get("limit")).toBe("25");
    for (const list of ["listVariablePage", "listPoolPage"] as const)
      expect(
        (await client[list]({ ...first, offset: 240 })).items,
      ).toHaveLength(10);
  });

  test("the DAG list sends its page, search and status to Airflow", async () => {
    const { client, requests } = connect(version);
    await client.listDagPage({
      limit: 50,
      offset: 100,
      search: "rev",
      paused: true,
    });
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({
      limit: "50",
      offset: "100",
      order_by: "dag_id",
      dag_id_pattern: "rev",
      paused: "true",
    });
  });
});

describe("searching where Airflow cannot", () => {
  test("API v1 reads the whole list and pages the matches", async () => {
    const { client, requests } = connect("v1");
    const page = await client.listConnectionPage({
      limit: 5,
      offset: 5,
      search: "CONN_2",
    });
    // conn_200 to conn_250 match, which lie past the first hundred records.
    expect(page.total).toBe(51);
    expect(page.items.map((item) => item.connectionId)).toEqual([
      "conn_205",
      "conn_206",
      "conn_207",
      "conn_208",
      "conn_209",
    ]);
    expect(requests).toHaveLength(3);
  });

  test("API v2 lets Airflow search", async () => {
    const { client, requests } = connect("v2");
    await client.listVariablePage({ ...first, search: "var_1" });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.searchParams.get("variable_key_pattern")).toBe("var_1");
  });
});
