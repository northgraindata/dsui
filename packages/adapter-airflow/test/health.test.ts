import { expect, test } from "bun:test";
import type { AirflowClient, AirflowContext, DagSummary } from "../src/context";
import { airflowHealth } from "../src/health";

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const dag = (dagId: string): DagSummary => ({
  dagId,
  description: "",
  isPaused: false,
  isStale: false,
  lastParsedTime: "",
  name: dagId,
  nextRun: "",
  owners: "",
  schedule: "",
  tags: "",
});

/** A client whose sign-in, version call and DAG listing each take as long as asked. */
function contextOf(delays: {
  authenticate?: number;
  listDags?: number;
  version?: number;
  failAuthenticate?: boolean;
  failVersion?: boolean;
}) {
  const calls: string[] = [];
  const client = {
    authenticate: async () => {
      calls.push("authenticate");
      await wait(delays.authenticate ?? 0);
      if (delays.failAuthenticate)
        throw new Error("Airflow authentication failed (HTTP 401)");
    },
    dispose: () => undefined,
    getVersion: async () => {
      calls.push("version");
      await wait(delays.version ?? 0);
      if (delays.failVersion)
        throw new Error("Airflow request failed (HTTP 503)");
      return { version: "3.0.2" };
    },
    listDags: async () => {
      calls.push("dags");
      await wait(delays.listDags ?? 0);
      return [dag("a"), dag("b")];
    },
  } as unknown as AirflowClient;
  return {
    calls,
    context: { client, config: {} } as unknown as AirflowContext,
  };
}

test("the response time is Airflow answering one call, not the login or the DAG listing", async () => {
  const { context } = contextOf({
    authenticate: 250,
    listDags: 250,
    version: 15,
  });
  const report = await airflowHealth(context);
  // The whole check takes over 500 ms; the answer to `version` took about 15.
  expect(report.latencyMs).toBeDefined();
  expect(report.latencyMs ?? Number.POSITIVE_INFINITY).toBeLessThan(150);
  const detail = report.checks.find(
    (check) => check.id === "reachability",
  )?.detail;
  expect(detail).toBe(`${report.latencyMs} ms response time`);
});

test("it signs in first, then asks for the version, then lists the DAGs", async () => {
  const { calls, context } = contextOf({});
  await airflowHealth(context);
  expect(calls).toEqual(["authenticate", "version", "dags"]);
});

test("a login that fails is reported as unreachable, with Airflow's reason, and nothing else is asked", async () => {
  const { calls, context } = contextOf({ failAuthenticate: true });
  const report = await airflowHealth(context);
  expect(report.status).toBe("unavailable");
  expect(report.checks[0]?.detail).toBe(
    "Airflow authentication failed (HTTP 401)",
  );
  expect(calls).toEqual(["authenticate"]);
});

test("a version call that fails is reported as unreachable", async () => {
  const { context } = contextOf({ failVersion: true });
  const report = await airflowHealth(context);
  expect(report.status).toBe("unavailable");
  expect(report.latencyMs).toBeUndefined();
});

test("the DAG listing still decides the scheduler check, but not the response time", async () => {
  const { context } = contextOf({});
  const report = await airflowHealth(context);
  expect(report.checks.find((check) => check.id === "scheduler")?.detail).toBe(
    "2 of 2 DAGs active",
  );
});
