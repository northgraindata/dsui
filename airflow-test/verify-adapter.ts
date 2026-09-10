/**
 * Exercises every AirflowClient method against the local deployment.
 *
 *   bun airflow-test/verify-adapter.ts
 */
import { createAirflowClient } from "../packages/adapter-airflow/src/client.js";

const baseUrl = process.env.AIRFLOW_BASE_URL ?? "http://localhost:8080";
const username = process.env.AIRFLOW_USERNAME ?? "admin";
const password = process.env.AIRFLOW_PASSWORD ?? "admin";

async function mintToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok)
    throw new Error(`token request failed: HTTP ${response.status}`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("no access_token in response");
  return body.access_token;
}

let failures = 0;

async function step<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    const value = await run();
    const preview = Array.isArray(value)
      ? `${value.length} record(s)`
      : JSON.stringify(value)?.slice(0, 120);
    console.log(`  ok   ${label}: ${preview}`);
    return value;
  } catch (cause) {
    failures += 1;
    console.log(`  FAIL ${label}: ${cause instanceof Error ? cause.message : cause}`);
    return null;
  }
}

const client = createAirflowClient({
  baseUrl,
  token: process.env.AIRFLOW_TOKEN ?? (await mintToken()),
});

try {
  console.log(`Airflow at ${baseUrl}`);
  await step("getVersion", () => client.getVersion());

  const dags = await step("listDags", () => client.listDags());
  const dagId = "warehouse_daily";
  await step(`getDag(${dagId})`, () => client.getDag(dagId));
  const tasks = await step(`listDagTasks(${dagId})`, () =>
    client.listDagTasks(dagId),
  );
  if (tasks?.length)
    console.log(
      `       graph: ${tasks
        .map((task) => `${task.taskId}<-[${task.upstreamTaskIds.join(",")}]`)
        .join(" ")}`,
    );

  const runs = await step(`listDagRuns(${dagId})`, () =>
    client.listDagRuns(dagId),
  );
  const runId = runs?.[0]?.dagRunId;
  if (runId) {
    await step("getDagRun", () => client.getDagRun(dagId, runId));
    const instances = await step("listTaskInstances", () =>
      client.listTaskInstances(dagId, runId),
    );
    const instance = instances?.find((candidate) => candidate.tryNumber > 0);
    if (instance) {
      const ref = {
        dagId,
        dagRunId: runId,
        taskId: instance.taskId,
        mapIndex: instance.mapIndex,
      };
      await step(`getTaskInstance(${instance.taskId})`, () =>
        client.getTaskInstance(ref),
      );
      await step(`getTaskLog(try ${instance.tryNumber})`, () =>
        client.getTaskLog({ ...ref, tryNumber: instance.tryNumber }),
      );
    }
  }

  // Mapped tasks: map_index is only meaningful when a task fans out.
  const mappedRuns = await step("listDagRuns(partition_backfill)", () =>
    client.listDagRuns("partition_backfill"),
  );
  const mappedRunId = mappedRuns?.[0]?.dagRunId;
  if (mappedRunId) {
    const mapped = await step("listTaskInstances(mapped)", () =>
      client.listTaskInstances("partition_backfill", mappedRunId),
    );
    const indexes = mapped
      ?.filter((candidate) => candidate.taskId === "load_region")
      .map((candidate) => candidate.mapIndex);
    console.log(`       load_region map indexes: ${JSON.stringify(indexes)}`);
  }

  const assets = await step("listAssets", () => client.listAssets());
  const assetId = assets?.[0]?.assetId;
  if (assetId !== undefined) {
    await step("getAsset", () => client.getAsset(assetId));
    await step("listAssetEvents", () => client.listAssetEvents(assetId));
  }

  // Mutations, on the DAG kept paused so scheduled runs stay predictable.
  await step("setDagPaused(legacy_export, false)", () =>
    client.setDagPaused("legacy_export", false),
  );
  const triggered = await step("triggerDag(legacy_export)", () =>
    client.triggerDag("legacy_export", { source: "dsui-verify" }),
  );
  await step("setDagPaused(legacy_export, true)", () =>
    client.setDagPaused("legacy_export", true),
  );
  if (triggered)
    await step("clearTaskInstance(collect_rows)", () =>
      client.clearTaskInstance(
        {
          dagId: "legacy_export",
          dagRunId: triggered.dagRunId,
          taskId: "collect_rows",
          mapIndex: -1,
        },
        false,
      ),
    );

  console.log(failures ? `\n${failures} call(s) failed` : "\nall calls passed");
} finally {
  client.dispose();
}

process.exit(failures ? 1 : 0);
