import { randomUUID } from "node:crypto";
import type { RuntimePluginJob } from "@northgraindata/dsui-plugin-sdk";
import type { DsuiDatabase } from "../db/database.js";
import { parseCron } from "./cron.js";
import { JobQueue, type JobRunRow } from "./job-queue.js";

type RegisteredJob = { pluginId: string; job: RuntimePluginJob };

/** Persistence operations the in-process worker needs from a queue backend. */
export type PluginJobQueueBackend = Pick<
  JobQueue,
  | "advanceSchedule"
  | "appendAttemptLog"
  | "claim"
  | "definition"
  | "definitions"
  | "dueDefinitions"
  | "enqueue"
  | "fail"
  | "isCancelRequested"
  | "markSideEffect"
  | "reclaimExpiredLeases"
  | "removeJob"
  | "renew"
  | "succeed"
  | "upsertDefinition"
>;

/**
 * In-process worker and scheduler for plugin jobs.
 *
 * Queue state lives in the host SQLite database; handlers remain registered
 * plugin functions in this process. This boundary lets the queue backend be
 * replaced without changing the plugin SDK contract.
 */
export class PluginJobService {
  private readonly queue: PluginJobQueueBackend;
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling: Promise<void> | undefined;
  private activeRun:
    | { controller: AbortController; done: Promise<void> }
    | undefined;
  private stopped = false;
  private readonly owner = randomUUID();
  private readonly leaseMs = 30_000;

  constructor(
    database: DsuiDatabase,
    private readonly registeredJobs: () => RegisteredJob[],
    queue?: PluginJobQueueBackend,
  ) {
    this.queue = queue ?? new JobQueue(database, this.leaseMs);
  }

  enqueue(
    pluginId: string,
    jobId: string,
    input: unknown,
    idempotencyKey?: string,
  ) {
    const registration = this.registeredJobs().find(
      ({ pluginId: owner, job }) => owner === pluginId && job.id === jobId,
    );
    if (!registration)
      throw new Error(`Unknown plugin job "${pluginId}/${jobId}"`);
    const parsed = registration.job.input?.parse(input) ?? input ?? null;
    const definition = this.queue.definition(jobId, pluginId);
    if (!definition)
      throw new Error(`Plugin job "${pluginId}/${jobId}" is unavailable`);
    return this.queue.enqueue({
      pluginId,
      jobId,
      input: parsed,
      maxAttempts: definition.maxAttempts,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  async start(): Promise<void> {
    if (this.timer) return;
    this.stopped = false;
    this.refreshDefinitions();
    this.timer = setInterval(() => {
      if (!this.polling)
        this.polling = this.poll()
          .catch((error: unknown) => {
            console.error("Background job scheduler failed", error);
          })
          .finally(() => {
            this.polling = undefined;
          });
    }, 100);
    if (typeof this.timer === "object" && "unref" in this.timer)
      this.timer.unref();
    this.polling = this.poll()
      .catch((error: unknown) => {
        console.error("Background job scheduler failed", error);
      })
      .finally(() => {
        this.polling = undefined;
      });
  }

  async close(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.activeRun?.controller.abort(
      new Error("Background job service stopped"),
    );
    await this.polling;
    await this.activeRun?.done;
  }

  refreshDefinitions(): void {
    const current = this.registeredJobs();
    const currentIds = new Set(
      current.map(({ pluginId, job }) => `${pluginId}:${job.id}`),
    );
    for (const definition of this.queue.definitions()) {
      if (!currentIds.has(`${definition.pluginId}:${definition.jobId}`))
        this.queue.removeJob(definition.jobId, definition.pluginId);
    }
    const now = new Date();
    for (const { pluginId, job } of current) {
      const nextRunAt = job.schedule
        ? parseCron(job.schedule).nextAfter(now)
        : job.intervalMs !== undefined
          ? now.getTime() + job.intervalMs
          : null;
      this.queue.upsertDefinition({
        jobId: job.id,
        pluginId,
        scheduleExpr: job.schedule ?? null,
        intervalMs: job.intervalMs ?? null,
        concurrency: job.concurrency,
        timeoutMs: job.timeoutMs,
        maxAttempts: job.retry.maxAttempts,
        backoffMs: job.retry.backoffMs,
        nextRunAt:
          nextRunAt === null ? null : new Date(nextRunAt).toISOString(),
      });
    }
  }

  private async poll(): Promise<void> {
    if (this.stopped) return;
    this.queue.reclaimExpiredLeases();
    const now = new Date();
    for (const definition of this.queue.dueDefinitions(now)) {
      const registered = this.registeredJobs().find(
        ({ pluginId, job }) =>
          pluginId === definition.pluginId && job.id === definition.jobId,
      );
      if (!registered) continue;
      // Coalesce missed periods after downtime into one fresh run; replaying
      // every missed sample would create a large, stale monitoring backlog.
      const scheduledFor = now;
      this.queue.enqueue({
        jobId: definition.jobId,
        pluginId: definition.pluginId,
        input: null,
        maxAttempts: definition.maxAttempts,
        scheduledFor,
      });
      const nextRunAt =
        definition.intervalMs !== null
          ? scheduledFor.getTime() + definition.intervalMs
          : definition.scheduleExpr
            ? parseCron(definition.scheduleExpr).nextAfter(scheduledFor)
            : null;
      if (nextRunAt !== null)
        this.queue.advanceSchedule(
          definition.jobId,
          definition.pluginId,
          new Date(nextRunAt),
        );
    }

    if (this.activeRun) return;
    const run = this.queue.claim(this.owner);
    if (!run) return;
    const controller = new AbortController();
    const done = this.execute(run, controller).finally(() => {
      if (this.activeRun?.done === done) this.activeRun = undefined;
    });
    this.activeRun = { controller, done };
    await done;
  }

  private async execute(
    run: JobRunRow,
    controller: AbortController,
  ): Promise<void> {
    const registration = this.registeredJobs().find(
      ({ pluginId, job }) => pluginId === run.pluginId && job.id === run.jobId,
    );
    if (!registration) {
      this.queue.fail(run.runId, this.owner, "Job is no longer registered");
      return;
    }
    let sideEffect = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(
        new Error(`Job exceeded ${registration.job.timeoutMs}ms`),
      );
    }, registration.job.timeoutMs);
    const heartbeat = setInterval(
      () => {
        if (!this.queue.renew(run.runId, this.owner))
          controller.abort(new Error("Job lease was lost"));
        else if (this.queue.isCancelRequested(run.runId))
          controller.abort(new Error("Job was cancelled"));
      },
      Math.max(250, Math.floor(this.leaseMs / 3)),
    );
    const log = (level: "info" | "warn" | "error", message: string) => {
      const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
      this.queue.appendAttemptLog(run.runId, run.attemptCount, line);
      if (level === "error")
        console.error(`[plugin-job:${run.pluginId}/${run.jobId}] ${message}`);
      else if (level === "warn")
        console.warn(`[plugin-job:${run.pluginId}/${run.jobId}] ${message}`);
    };
    try {
      await registration.job.invoke(JSON.parse(run.inputJson), {
        runId: run.runId,
        signal: controller.signal,
        logger: {
          info: (message) => log("info", message),
          warn: (message) => log("warn", message),
          error: (message) => log("error", message),
        },
        reportSideEffect: () => {
          sideEffect = true;
          if (!this.queue.markSideEffect(run.runId, this.owner))
            controller.abort(
              new Error("Job lease was lost before side effect"),
            );
        },
      });
      if (timedOut || controller.signal.aborted)
        throw controller.signal.reason ?? new Error("Job aborted");
      this.queue.succeed(run.runId, this.owner);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryAt =
        !sideEffect && run.attemptCount < run.maxAttempts
          ? new Date(
              Date.now() +
                retryDelay(registration.job.retry.backoffMs, run.attemptCount),
            )
          : undefined;
      this.queue.fail(run.runId, this.owner, message, {
        outcomeUnknown: sideEffect,
        ...(retryAt ? { retryAt } : {}),
      });
      log("error", message);
    } finally {
      clearTimeout(timeout);
      clearInterval(heartbeat);
    }
  }
}

function retryDelay(baseMs: number, attempt: number): number {
  const exponential = Math.min(baseMs * 2 ** Math.max(0, attempt - 1), 60_000);
  return Math.round(exponential * (0.8 + Math.random() * 0.4));
}
