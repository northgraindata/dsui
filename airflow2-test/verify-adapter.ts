/** Exercises every AirflowClient method against the Airflow 2 demo. */
import { createAirflowClient } from "../packages/adapter-airflow/src/client.js";

const baseUrl = process.env.AIRFLOW_BASE_URL ?? "http://localhost:8081";
const username = process.env.AIRFLOW_USERNAME ?? "admin";
const password = process.env.AIRFLOW_PASSWORD ?? "admin";

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
    console.log(
      `  FAIL ${label}: ${cause instanceof Error ? cause.message : cause}`,
    );
    return null;
  }
}

const client = createAirflowClient({
  apiVersion: "v1",
  baseUrl,
  username,
  password,
});

try {
  console.log(`Airflow 2 at ${baseUrl}`);
  await step("getVersion", () => client.getVersion());

  const dags = await step("listDags", () => client.listDags());
  const dagId = "warehouse_daily";
  if (dags?.some((dag) => dag.dagId === dagId)) {
    await step(`getDag(${dagId})`, () => client.getDag(dagId));
    await step(`listDagTasks(${dagId})`, () => client.listDagTasks(dagId));
  }

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
      await step("getTaskInstance", () => client.getTaskInstance(ref));
      await step("getTaskLog", () =>
        client.getTaskLog({ ...ref, tryNumber: instance.tryNumber }),
      );
    }
  }

  const mappedRuns = await step("listDagRuns(partition_backfill)", () =>
    client.listDagRuns("partition_backfill"),
  );
  if (mappedRuns?.[0])
    await step("listTaskInstances(mapped)", () =>
      client.listTaskInstances(
        "partition_backfill",
        mappedRuns[0]?.dagRunId ?? "",
      ),
    );

  const assets = await step("listAssets", () => client.listAssets());
  if (assets?.[0]) {
    await step("getAsset", () => client.getAsset(assets[0]?.assetId ?? -1));
    await step("listAssetEvents", () =>
      client.listAssetEvents(assets[0]?.assetId ?? -1),
    );
  }

  await step("setDagPaused(legacy_export, false)", () =>
    client.setDagPaused("legacy_export", false),
  );
  const triggered = await step("triggerDag(legacy_export)", () =>
    client.triggerDag("legacy_export", { source: "dsui-airflow2-verify" }),
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
