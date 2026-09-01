import { expect, test } from "bun:test";
import adapter from "../src/index";

test("requires an Airflow webserver URL", () => {
  expect(() => adapter.connectionSchema.parse({})).toThrow();
});

test("is named Apache Airflow and detects the REST API by default", () => {
  expect(adapter.metadata.name).toBe("Apache Airflow");
  expect(
    adapter.connectionSchema.parse({ baseUrl: "http://airflow:8080" })
      .apiVersion,
  ).toBe("auto");
});

test("covers Airflow 2 and 3 public API surfaces", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  for (const id of [
    "dags",
    "dag-runs",
    "task-instances",
    "assets",
    "asset-aliases",
    "asset-events",
    "backfills",
    "dag-versions",
    "pools",
    "variables",
    "connections",
    "providers",
    "plugins",
    "import-errors",
    "event-logs",
    "dag-warnings",
    "dag-source",
    "users",
    "roles",
    "permissions",
    "trigger-dag",
    "clear-task-instances",
    "materialize-asset",
    "backfill-action",
    "api-request",
  ])
    expect(ids).toContain(id);
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("prefers the Airflow 3 v2 API when it is available", async () => {
  const urls: string[] = [];
  const instance = adapter.create(
    {
      fetch: (async (input) => {
        const url = String(input);
        urls.push(url);
        if (url.endsWith("/api/v2/version")) return json({ version: "3.0.0" });
        if (url.endsWith("/api/v2/monitor/health"))
          return json({ metadatabase: { status: "healthy" } });
        return json({}, 404);
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ baseUrl: "http://airflow:8080" }),
  );

  expect((await instance.health()).status).toBe("healthy");
  expect(urls).toEqual([
    "http://airflow:8080/api/v2/version",
    "http://airflow:8080/api/v2/monitor/health",
  ]);
});

test("falls back to the Airflow 2 v1 API", async () => {
  const urls: string[] = [];
  const instance = adapter.create(
    {
      fetch: (async (input) => {
        const url = String(input);
        urls.push(url);
        if (url.endsWith("/api/v2/version")) return json({}, 404);
        if (url.endsWith("/api/v1/version")) return json({ version: "2.10.0" });
        if (url.endsWith("/api/v1/health"))
          return json({ scheduler: { status: "healthy" } });
        return json({}, 404);
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ baseUrl: "http://airflow:8080" }),
  );

  expect((await instance.health()).status).toBe("healthy");
  expect(urls).toEqual([
    "http://airflow:8080/api/v2/version",
    "http://airflow:8080/api/v1/version",
    "http://airflow:8080/api/v1/health",
  ]);
});

test("provides safe access to every endpoint in the negotiated API", async () => {
  const urls: string[] = [];
  const instance = adapter.create(
    {
      fetch: (async (input) => {
        const url = String(input);
        urls.push(url);
        return json(url.endsWith("/version") ? { version: "3.0.0" } : {});
      }) as typeof fetch,
    },
    adapter.connectionSchema.parse({ baseUrl: "http://airflow:8080" }),
  );

  await instance.execute("api-request", {
    method: "GET",
    path: "/backfills",
  });
  expect(urls.at(-1)).toBe("http://airflow:8080/api/v2/backfills");
  expect(instance.execute("api-request", { path: "/../ui" })).rejects.toThrow(
    "safe path",
  );
});
