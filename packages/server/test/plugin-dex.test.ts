import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  definePlugin,
  type PluginPrincipal,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import { CHECK_STEPS } from "../../plugin-dex/src/check";
import { configSchema } from "../../plugin-dex/src/config";
import { runDetailSchema } from "../../plugin-dex/src/contract";
import { database } from "../../plugin-dex/src/database";
import { runSchedules } from "../../plugin-dex/src/jobs";
import {
  listOutputs,
  readOutput,
  saveOutput,
} from "../../plugin-dex/src/outputs";
import { createDexPlugin } from "../../plugin-dex/src/plugin";
import { createRun, interruptRuns, listRuns } from "../../plugin-dex/src/runs";
import {
  claimSchedules,
  listSchedules,
  nextOccurrence,
  saveRule,
} from "../../plugin-dex/src/schedules";
import { createRuntime } from "../src/app";
import { createPluginStorage } from "../src/plugins/storage";

const warsaw = "Europe/Warsaw";
const daily = (time: string) => ({ kind: "daily", time }) as const;
const interval = { kind: "interval", intervalMinutes: 15 } as const;
const stamp = (value: string) => Date.parse(value);

test("daily Dex schedules follow installation time through DST", () => {
  expect(
    nextOccurrence(daily("15:00"), warsaw, stamp("2026-03-28T15:00Z")),
  ).toBe("2026-03-29T13:00:00.000Z");
  expect(
    nextOccurrence(daily("02:30"), warsaw, stamp("2026-03-28T15:00Z")),
  ).toBe("2026-03-30T00:30:00.000Z");
  expect(
    nextOccurrence(daily("02:30"), warsaw, stamp("2026-10-24T15:00Z")),
  ).toBe("2026-10-25T00:30:00.000Z");
  expect(
    nextOccurrence(daily("02:30"), warsaw, stamp("2026-10-25T00:40Z")),
  ).toBe("2026-10-26T01:30:00.000Z");
});

test("Dex migrates existing schedules and coalesces overlapping and overdue occurrences", async () => {
  const root = await mkdtemp("/private/tmp/dsui-dex-schedules-");
  const storage = createPluginStorage(root, "dex");
  try {
    const migrate = storage.migrate?.bind(storage);
    if (!migrate) throw new Error("Plugin migrations unavailable");
    database({
      ...storage,
      migrate: (name, migrations) => migrate(name, migrations.slice(0, 2)),
    })
      .query("INSERT INTO schedules VALUES ('demo', 15, ?)")
      .run("2026-01-01T14:00:00.000Z");
    const staleRun = storage
      .openDatabase("dex")
      .query(`INSERT INTO runs
      VALUES ('old', 'demo', 'manual', 'valid', '', '2025-01-01', NULL, '2025-01-01',
      '[]', '[]', 0, 0, '[]')`)
      .run();
    expect(staleRun.changes).toBe(1);
    expect(listSchedules(storage, "demo")).toEqual([
      {
        id: "legacy:demo",
        rule: interval,
        enabled: true,
        nextRunAt: "2026-01-01T14:00:00.000Z",
      },
    ]);
    const before = stamp("2026-01-01T13:45:00Z");
    const day = saveRule(
      storage,
      "demo",
      { rule: daily("15:00"), enabled: true },
      warsaw,
      before,
    );
    saveRule(
      storage,
      "demo",
      { rule: interval, enabled: false },
      warsaw,
      before,
    );
    const delayed = stamp("2026-01-01T14:05:00Z");
    const claimed = claimSchedules(storage, new Set(["demo"]), warsaw, delayed);
    expect(claimed.size).toBe(1);
    expect(claimed.get("demo")?.scheduledFor).toBe("2026-01-01T14:00:00.000Z");
    expect(
      claimSchedules(storage, new Set(["demo"]), "UTC", delayed).size,
    ).toBe(0);
    expect(
      listSchedules(storage, "demo").find(({ id }) => id === day.id)?.nextRunAt,
    ).toBe("2026-01-01T15:00:00.000Z");
    expect(listRuns(storage, "demo", 10)[0]?.id).toBe("old");
  } finally {
    storage.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Dex starts one overdue run after restart and advances schedules for a busy project", async () => {
  const root = await mkdtemp("/private/tmp/dsui-dex-restart-");
  const storage = createPluginStorage(root, "dex");
  let reopened: ReturnType<typeof createPluginStorage> | undefined;
  try {
    const previousDay = Date.now() - 24 * 60 * 60 * 1000;
    const first = saveRule(
      storage,
      "demo",
      { rule: interval, enabled: true, commands: ["verify"] },
      warsaw,
      previousDay,
    );
    saveRule(
      storage,
      "demo",
      { rule: interval, enabled: true, commands: ["inventory"] },
      warsaw,
      previousDay + 60_000,
    );
    saveRule(
      storage,
      "busy",
      { rule: interval, enabled: true },
      warsaw,
      previousDay,
    );
    storage.close();
    reopened = createPluginStorage(root, "dex");
    const busyRun = createRun(reopened, "busy", "manual", CHECK_STEPS);
    const config = configSchema.parse({
      executable: join(root, "dex"),
      projects: ["demo", "busy"].map((id) => ({ id, name: id, path: root })),
    });
    const queued: unknown[] = [];
    const context = {
      storage: reopened,
      installationTimeZone: () => warsaw,
      jobs: {
        enqueue: async (_job: string, input: unknown) => {
          queued.push(input);
          return { runId: "job-id" };
        },
      },
    };
    const warn = (message: string) => {
      throw new Error(message);
    };
    await runSchedules(context, config, warn);
    await runSchedules(context, config, warn);
    expect(queued).toHaveLength(1);
    const row = database(reopened)
      .query("SELECT commands FROM runs WHERE project_id = 'demo'")
      .get();
    expect(row).toEqual({ commands: '["verify","inventory"]' });
    expect(listRuns(reopened, "demo", 10)).toMatchObject([
      {
        trigger: "scheduled",
        scheduleId: first.id,
        scheduledFor: first.nextRunAt,
      },
    ]);
    expect(listRuns(reopened, "busy", 10)).toMatchObject([
      { id: busyRun, trigger: "manual" },
    ]);
    expect(
      Date.parse(listSchedules(reopened, "busy")[0]?.nextRunAt ?? ""),
    ).toBeGreaterThan(Date.now());
  } finally {
    reopened?.close();
    storage.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Dex stores redacted JSON, marks oversized payloads and prunes outputs with runs", async () => {
  const root = await mkdtemp("/private/tmp/dsui-dex-output-");
  const storage = createPluginStorage(root, "dex");
  try {
    const run = createRun(storage, "demo", "manual", CHECK_STEPS);
    const envelope = {
      status: "error",
      data: {
        file: "/project/models/demo.sql",
        credentials: { password: "hidden" },
      },
      errors: ["Could not read /project/models/demo.sql"],
      warnings: [],
      reason: null,
    } as const;
    saveOutput(storage, run, "map", {
      envelope: { ...envelope, errors: [...envelope.errors], warnings: [] },
      paths: ["/project"],
    });
    const output = readOutput(storage, "demo", run, "map");
    expect(output?.state).toBe("available");
    expect(JSON.parse(output?.json ?? "{}")).toMatchObject({
      status: "error",
      data: { file: "<project>/models/demo.sql" },
    });
    expect(output?.json).not.toContain("hidden");
    expect(readOutput(storage, "other", run, "map")).toBeNull();
    saveOutput(storage, run, "verify", {
      envelope: {
        status: "ok",
        data: "x".repeat(256 * 1024),
        warnings: [],
        errors: [],
        reason: null,
      },
      paths: [],
    });
    expect(readOutput(storage, "demo", run, "verify")).toMatchObject({
      state: "too-large",
      json: null,
    });
    interruptRuns(storage, "test");
    for (let index = 0; index < 100; index++) {
      createRun(storage, "demo", "manual", CHECK_STEPS);
      interruptRuns(storage, "test");
    }
    expect(listRuns(storage, "demo", 100)).toHaveLength(100);
    expect(listOutputs(storage, run)).toEqual([]);
  } finally {
    storage.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Dex reports a missing browser bundle as a configuration error", async () => {
  const root = await mkdtemp("/private/tmp/dsui-dex-bundle-");
  const runtime = createRuntime({
    dataDir: root,
    configPath: join(root, "missing.yaml"),
    config: {
      services: [],
      plugins: {
        dex: {
          package: "test-dex",
          enabled: true,
          browserBundle: join(root, "missing.mjs"),
          config: { executable: join(root, "dex") },
        },
      },
    },
    pluginModuleLoader: async () => ({ default: createDexPlugin() }),
  });
  try {
    await runtime.refreshConfig();
    const result = await runtime.app.request(
      "/api/v1/plugins/dex/pages/projects",
    );
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({
      message: expect.stringContaining("browser bundle is missing"),
    });
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Dex pages, check, history, output and schedule permissions use real HTTP routes", async () => {
  const root = await mkdtemp("/private/tmp/dsui-dex-http-test-");
  const projectPath = join(root, "project");
  const executable = join(root, "dex");
  await mkdir(join(projectPath, ".dex"), { recursive: true });
  await writeFile(join(projectPath, ".dex", "config.yml"), "{}");
  await writeFile(
    executable,
    `#!/bin/sh
case "$1 $2" in
  "maintain verify") printf '%s' '{"status":"ok","data":{"findings":[{"axis":"schema","code":"columns","identifier":"orders","column":"created_at","severity":"high","detail":"Missing column"}]}}' ;;
  "maintain check") printf '%s' '{"status":"error","reason":"prerequisite","errors":["missing baseline"]}' ;;
  "explore inventory") printf '%s' '{"status":"ok","data":{"objects":[]}}' ;;
  "explore diagram") printf '%s' '{"status":"ok","data":{"mermaid":"erDiagram"}}' ;;
  "explore semantic") printf '%s' '{"status":"ok","data":{"metrics":[]}}' ;;
  "transform plans") printf '%s' '{"status":"ok","data":{"plans":[]}}' ;;
  *) printf '%s' '{"status":"ok","connection":{"password":"hidden"},"data":{}}' ;;
esac
`,
    { mode: 0o700 },
  );
  let role: PluginPrincipal["role"] = "owner";
  const security = definePlugin({
    metadata: {
      id: "security",
      name: "Security",
      version: "1.0.0",
      apiVersion: 1,
      security: true,
    },
    configSchema: z.object({}),
    setup: (registry) =>
      registry.authentication({ authenticate: () => ({ id: "tester", role }) }),
  });
  const dex = createDexPlugin();
  const runtime = createRuntime({
    dataDir: root,
    configPath: join(root, "missing.yaml"),
    config: {
      services: [],
      settings: { timeZone: warsaw },
      plugins: {
        security: {
          package: "test-security",
          enabled: true,
          critical: true,
          config: {},
        },
        dex: {
          package: "test-dex",
          enabled: true,
          browserBundle: executable,
          config: {
            executable,
            projects: [{ id: "demo", name: "Dex demo", path: projectPath }],
          },
        },
      },
    },
    pluginModuleLoader: async (id) => ({
      default: id === "test-security" ? security : dex,
    }),
  });
  const path = "/api/v1/plugins/dex/";
  const get = (tail: string) => runtime.app.request(path + tail);
  const post = (tail: string, input: unknown) =>
    runtime.app.request(path + tail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  try {
    await runtime.refreshConfig();
    expect((await get("pages/projects")).status).toBe(200);
    expect((await get("pages/projects%2Fdemo")).status).toBe(200);
    expect((await get("pages/projects%2Fmissing")).status).toBe(404);
    expect((await get("components.mjs")).status).toBe(200);
    const start = await post("procedures/run-check", { projectId: "demo" });
    expect(start.status).toBe(200);
    const {
      data: { runId },
    } = await start.json();
    const responseSchema = z.object({
      data: z.object({ run: runDetailSchema.nullable() }),
    });
    const waitForRun = async (id: string) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const response = await post("resources/run", {
          projectId: "demo",
          runId: id,
        });
        const run = responseSchema.parse(await response.json()).data.run;
        if (run?.finishedAt) return run;
        await Bun.sleep(30);
      }
      throw new Error("Dex check did not finish");
    };
    const run = await waitForRun(runId);
    expect(run).toMatchObject({
      status: "issues",
      capturesOutput: true,
      problemCount: 1,
    });
    expect(run?.outputs).toHaveLength(7);
    expect(await (await post("resources/overview", {})).json()).toMatchObject({
      data: [
        {
          lastResult: {
            problem: { identifier: "orders", column: "created_at" },
          },
        },
      ],
    });
    const output = await post("procedures/run-output", {
      projectId: "demo",
      runId,
      command: "drift",
    });
    expect(output.status).toBe(200);
    expect(JSON.parse((await output.json()).data.json)).toMatchObject({
      status: "error",
      reason: "prerequisite",
    });
    const subset = await post("procedures/run-check", {
      projectId: "demo",
      commands: ["inventory"],
    });
    expect(subset.status).toBe(200);
    const scoped = await waitForRun((await subset.json()).data.runId);
    expect(scoped).toMatchObject({
      status: "partial",
      commands: ["inventory"],
      outputs: [{ command: "inventory", state: "available" }],
    });
    expect(scoped.outputs).toHaveLength(1);
    expect(
      scoped.steps.filter(({ state }) => state === "skipped"),
    ).toHaveLength(3);
    expect(
      (await post("procedures/run-check", { projectId: "demo", commands: [] }))
        .status,
    ).toBe(422);
    expect(
      (
        await post("procedures/run-check", {
          projectId: "demo",
          commands: ["map", "map"],
        })
      ).status,
    ).toBe(422);

    const rule = {
      projectId: "demo",
      rule: daily("15:00"),
      enabled: true,
      commands: ["verify"],
    };
    const schedule = await post("procedures/save-schedule", rule);
    expect(schedule.status).toBe(200);
    const {
      data: { id },
    } = await schedule.json();
    const pause = await post("procedures/save-schedule", {
      projectId: "demo",
      id,
      rule: rule.rule,
      enabled: false,
    });
    expect(pause.status).toBe(200);
    expect(
      await (await post("resources/schedules", { projectId: "demo" })).json(),
    ).toMatchObject({
      data: {
        timeZone: warsaw,
        rules: [{ rule: daily("15:00"), enabled: false, commands: ["verify"] }],
      },
    });
    role = "viewer";
    expect((await post("procedures/save-schedule", rule)).status).toBe(403);
    expect(
      (await post("procedures/run-check", { projectId: "demo" })).status,
    ).toBe(403);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);
