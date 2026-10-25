import { expect, test } from "bun:test";
import type { AirflowComponentHealth, AirflowContext } from "./context.js";
import { airflowHealth } from "./health.js";

function context(options: {
  components?: AirflowComponentHealth[] | Error;
  unreachable?: boolean;
}): AirflowContext {
  return {
    client: {
      getVersion: async () => {
        if (options.unreachable) throw new Error("connect ECONNREFUSED");
        return { version: "2.9.1" };
      },
      listDags: async () => [{ isPaused: false }, { isPaused: false }],
      getHealth: async () => {
        if (options.components instanceof Error) throw options.components;
        return options.components ?? [];
      },
    },
  } as unknown as AirflowContext;
}

const byId = (report: Awaited<ReturnType<typeof airflowHealth>>) =>
  new Map(report.checks.map((check) => [check.id, check]));

test("healthy components add checks next to the existing ones", async () => {
  const report = await airflowHealth(
    context({
      components: [
        { id: "metadatabase", status: "healthy" },
        { id: "scheduler", status: "healthy" },
      ],
    }),
  );
  expect(report.status).toBe("healthy");
  expect([...byId(report).keys()]).toEqual([
    "reachability",
    "version",
    "scheduler",
    "metadatabase",
    "scheduler-heartbeat",
  ]);
});

test("a dead scheduler degrades the service and links to the DAGs", async () => {
  const report = await airflowHealth(
    context({
      components: [
        { id: "metadatabase", status: "healthy" },
        { id: "scheduler", status: "unhealthy" },
      ],
    }),
  );
  expect(byId(report).get("scheduler-heartbeat")).toMatchObject({
    ok: false,
    detail: "Reported unhealthy",
    href: "/dags",
  });
  expect(report.status).toBe("warning");
  expect(report.score).toBe(50);
});

test("the DAG availability check keeps its id", async () => {
  const report = await airflowHealth(context({ components: [] }));
  expect(byId(report).get("scheduler")).toMatchObject({
    label: "DAG availability",
  });
});

test("a deployment that does not expose health is not blamed", async () => {
  const report = await airflowHealth(
    context({ components: new Error("HTTP 404") }),
  );
  expect(report.status).toBe("healthy");
  expect(byId(report).has("scheduler-heartbeat")).toBe(false);
});

test("an unreachable deployment is unavailable", async () => {
  const report = await airflowHealth(context({ unreachable: true }));
  expect(report.status).toBe("unavailable");
});
