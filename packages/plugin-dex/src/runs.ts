/** Stored check runs. */
import { randomUUID } from "node:crypto";
import {
  PluginRequestError,
  type PluginStorage,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import {
  type Finding,
  findingSchema,
  type OutputCommand,
  type RunDetail,
  type RunStatus,
  type RunStep,
  type RunSummary,
  runCommandsSchema,
  runDetailSchema,
  runSummarySchema,
  stepSchema,
} from "./contract.js";
import { database } from "./database.js";
import { listOutputs } from "./outputs.js";

const KEPT_RUNS_PER_PROJECT = 100;

const rowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  trigger: z.string(),
  status: z.string(),
  message: z.string(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  steps: z.string(),
  findings: z.string(),
  finding_count: z.number(),
  problem_count: z.number(),
  not_checked: z.string(),
  schedule_id: z.string().nullable(),
  scheduled_for: z.string().nullable(),
  captures_output: z.number(),
  commands: z.string().nullable(),
});

function detail(value: unknown): RunDetail {
  const row = rowSchema.parse(value);
  const steps = z.array(stepSchema).parse(JSON.parse(row.steps));
  return runDetailSchema.parse({
    id: row.id,
    projectId: row.project_id,
    trigger: row.trigger,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
    scheduleId: row.schedule_id,
    scheduledFor: row.scheduled_for,
    capturesOutput: row.captures_output === 1,
    ...(row.commands && {
      commands: runCommandsSchema.parse(JSON.parse(row.commands)),
    }),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    findingCount: row.finding_count,
    problemCount: row.problem_count,
    driftChecked: steps.some(
      (step) => step.id === "drift" && step.state === "ok",
    ),
    steps,
    findings: z.array(findingSchema).parse(JSON.parse(row.findings)),
    notChecked: z.array(z.string()).parse(JSON.parse(row.not_checked)),
  });
}

/** Parsing with the summary schema drops the large detail fields. */
const summary = (value: unknown): RunSummary =>
  runSummarySchema.parse(detail(value));

/** Queues a run, refusing a second one while the project has one unfinished. */
export function createRun(
  storage: PluginStorage,
  projectId: string,
  trigger: RunSummary["trigger"],
  steps: readonly RunStep[],
  options?: {
    scheduled?: { scheduleId: string; scheduledFor: string };
    commands?: readonly OutputCommand[];
  },
): string {
  const db = database(storage);
  const id = randomUUID();
  db.transaction(() => {
    const active = db
      .query(
        "SELECT 1 FROM runs WHERE project_id = ? AND status IN ('queued', 'running')",
      )
      .get(projectId);
    if (active)
      throw new PluginRequestError(
        `A check is already running for project "${projectId}"`,
        409,
      );
    db.query(
      `INSERT INTO runs (id, project_id, trigger, status, message, created_at, steps, findings, finding_count, problem_count, not_checked, schedule_id, scheduled_for, captures_output, commands)
       VALUES (?, ?, ?, 'queued', '', ?, ?, '[]', 0, 0, '[]', ?, ?, 1, ?)`,
    ).run(
      id,
      projectId,
      trigger,
      new Date().toISOString(),
      JSON.stringify(steps),
      options?.scheduled?.scheduleId ?? null,
      options?.scheduled?.scheduledFor ?? null,
      options?.commands ? JSON.stringify(options.commands) : null,
    );
    db.query(
      `DELETE FROM runs WHERE project_id = ? AND id NOT IN (
         SELECT id FROM runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)`,
    ).run(projectId, projectId, KEPT_RUNS_PER_PROJECT);
  }).immediate();
  return id;
}

/** Claims a queued run. False when it was already finished or interrupted. */
export function startRun(storage: PluginStorage, runId: string): boolean {
  return (
    database(storage)
      .query(
        "UPDATE runs SET status = 'running', started_at = ? WHERE id = ? AND status = 'queued'",
      )
      .run(new Date().toISOString(), runId).changes === 1
  );
}

export function saveProgress(
  storage: PluginStorage,
  runId: string,
  steps: readonly RunStep[],
): void {
  database(storage)
    .query("UPDATE runs SET steps = ? WHERE id = ?")
    .run(JSON.stringify(steps), runId);
}

export function finishRun(
  storage: PluginStorage,
  runId: string,
  result: {
    status: RunStatus;
    message: string;
    steps: readonly RunStep[];
    findings: readonly Finding[];
    findingCount: number;
    problemCount: number;
    notChecked: readonly string[];
  },
): void {
  database(storage)
    .query(
      `UPDATE runs SET status = ?, message = ?, finished_at = ?, steps = ?, findings = ?,
         finding_count = ?, problem_count = ?, not_checked = ? WHERE id = ?`,
    )
    .run(
      result.status,
      result.message,
      new Date().toISOString(),
      JSON.stringify(result.steps),
      JSON.stringify(result.findings),
      result.findingCount,
      result.problemCount,
      JSON.stringify(result.notChecked),
      runId,
    );
}

/** Ends runs that cannot finish, so they stop blocking the project. */
export function interruptRuns(
  storage: PluginStorage,
  message: string,
  runId?: string,
): void {
  const db = database(storage);
  const rows = db
    .query(
      "SELECT * FROM runs WHERE status IN ('queued', 'running') AND (?1 IS NULL OR id = ?1)",
    )
    .all(runId ?? null);
  for (const row of rows) {
    const run = detail(row);
    finishRun(storage, run.id, {
      ...run,
      status: "incomplete",
      message,
      steps: run.steps.map((step) =>
        step.state === "running" || step.state === "pending"
          ? { ...step, state: "failed", message: "Did not finish" }
          : step,
      ),
    });
  }
}

export function readRun(
  storage: PluginStorage,
  projectId: string,
  runId?: string,
): RunDetail | null {
  const db = database(storage);
  const row = runId
    ? db
        .query("SELECT * FROM runs WHERE project_id = ? AND id = ?")
        .get(projectId, runId)
    : db
        .query(
          "SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
        )
        .get(projectId);
  if (!row) return null;
  const run = detail(row);
  return { ...run, outputs: listOutputs(storage, run.id) };
}

export function listRuns(
  storage: PluginStorage,
  projectId: string,
  limit: number,
): RunSummary[] {
  return database(storage)
    .query(
      "SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
    )
    .all(projectId, limit)
    .map(summary);
}

export function recentRuns(storage: PluginStorage, projectId: string) {
  const db = database(storage);
  const latestRow = db
    .query(
      "SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .get(projectId);
  if (!latestRow) return { lastRun: null, lastResult: null };
  const latest = detail(latestRow);
  const lastRun = runSummarySchema.parse(latest);
  const active = latest.status === "running" || latest.status === "queued";
  const previous = active
    ? db
        .query(`SELECT * FROM runs WHERE project_id = ? AND finished_at IS NOT NULL
        ORDER BY created_at DESC, rowid DESC LIMIT 1`)
        .get(projectId)
    : null;
  const previousRun = previous ? detail(previous) : null;
  const completed = active ? previousRun : latest;
  const lastResult = completed && {
    run: runSummarySchema.parse(completed),
    problem:
      completed.findings.find((finding) => finding.severity !== "low") ?? null,
    failedStep:
      completed.steps.find(
        (step) =>
          step.state === "failed" || step.state === "needs-confirmation",
      ) ?? null,
  };
  return { lastRun, lastResult };
}
