/**
 * Durable job queue on SQLite.
 *
 * The claim is the whole design. Selecting a runnable run and marking it running
 * has to be one atomic step, or two workers select the same row and a job runs
 * twice. With WAL and a busy timeout, a transaction that updates the row it just
 * selected is enough: whoever commits first changes the status, and the loser's
 * conditional update affects no rows.
 *
 * Every write that changes a run's state is guarded by the caller's lease owner.
 * A worker that lost its lease to an expiry cannot then write a result: the
 * update matches nothing and the write is discarded. Without that guard a slow
 * worker whose lease expired mid-run would overwrite the result of whoever
 * re-claimed the job.
 */
import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import type { DsuiDatabase } from "../db/database.js";

export type JobRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface JobRunRow {
  runId: string;
  jobId: string;
  pluginId: string;
  status: JobRunStatus;
  inputJson: string;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey: string | null;
  requestHash: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  scheduledFor: string | null;
  enqueuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  outcomeUnknown: boolean;
  cancelRequested: boolean;
}

export interface JobAttemptRow {
  runId: string;
  attempt: number;
  status: JobRunStatus;
  error: string | null;
  logs: string | null;
  artifacts: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface JobDefinitionRow {
  jobId: string;
  pluginId: string;
  scheduleExpr: string | null;
  intervalMs: number | null;
  concurrency: "singleton" | "per-key";
  timeoutMs: number;
  maxAttempts: number;
  backoffMs: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

function toDefinition(row: Record<string, unknown>): JobDefinitionRow {
  return {
    jobId: String(row.job_id),
    pluginId: String(row.plugin_id),
    scheduleExpr: row.schedule_expr === null ? null : String(row.schedule_expr),
    intervalMs: row.interval_ms === null ? null : Number(row.interval_ms),
    concurrency: String(row.concurrency) as "singleton" | "per-key",
    timeoutMs: Number(row.timeout_ms),
    maxAttempts: Number(row.max_attempts),
    backoffMs: Number(row.backoff_ms),
    nextRunAt: row.next_run_at === null ? null : String(row.next_run_at),
    lastRunAt: row.last_run_at === null ? null : String(row.last_run_at),
    createdAt: String(row.created_at),
  };
}

function toAttempt(row: Record<string, unknown>): JobAttemptRow {
  return {
    runId: String(row.run_id),
    attempt: Number(row.attempt),
    status: String(row.status) as JobRunStatus,
    error: row.error === null ? null : String(row.error),
    logs: row.logs === null ? null : String(row.logs),
    artifacts: row.artifacts === null ? null : String(row.artifacts),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
  };
}

const RUN_COLUMNS = `run_id, job_id, plugin_id, status, input_json, attempt_count,
  max_attempts, idempotency_key, request_hash, lease_owner, lease_expires_at,
  scheduled_for, enqueued_at, started_at, finished_at, last_error,
  outcome_unknown, cancel_requested`;

function toRun(row: Record<string, unknown>): JobRunRow {
  return {
    runId: String(row.run_id),
    jobId: String(row.job_id),
    pluginId: String(row.plugin_id),
    status: String(row.status) as JobRunStatus,
    inputJson: String(row.input_json),
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
    idempotencyKey:
      row.idempotency_key === null ? null : String(row.idempotency_key),
    requestHash: row.request_hash === null ? null : String(row.request_hash),
    leaseOwner: row.lease_owner === null ? null : String(row.lease_owner),
    leaseExpiresAt:
      row.lease_expires_at === null ? null : String(row.lease_expires_at),
    scheduledFor: row.scheduled_for === null ? null : String(row.scheduled_for),
    enqueuedAt: String(row.enqueued_at),
    startedAt: row.started_at === null ? null : String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
    lastError: row.last_error === null ? null : String(row.last_error),
    outcomeUnknown: Number(row.outcome_unknown) === 1,
    cancelRequested: Number(row.cancel_requested) === 1,
  };
}

/**
 * Stable hash of a payload, used to reject an idempotency key reused with
 * different input.
 *
 * `JSON.stringify` in insertion order is the wrong tool: `{a,b}` and `{b,a}`
 * are the same request but serialise differently, and the caller would get a
 * false conflict. Keys are sorted so the hash describes the payload rather than
 * the order the object was built in.
 */
export function hashRequest(payload: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, canonical(item)]),
      );
    }
    return value;
  };
  const text = JSON.stringify(canonical(payload) ?? null);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length.toString(16)}-${hash.toString(16)}`;
}

export class JobQueue {
  constructor(
    private readonly database: DsuiDatabase,
    /** How long a claim is valid before another worker may take the run. */
    private readonly leaseMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private get db(): Database {
    return (this.database as unknown as { sqlite: Database }).sqlite;
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  /**
   * Registers or refreshes a job definition.
   *
   * Called when a plugin loads, so it overwrites rather than duplicating. The
   * schedule cursor is left alone when the schedule has not changed: a plugin
   * restart must not push a job due in ten minutes into a fresh full period.
   */
  upsertDefinition(definition: {
    jobId: string;
    pluginId: string;
    scheduleExpr: string | null;
    intervalMs: number | null;
    concurrency: "singleton" | "per-key";
    timeoutMs: number;
    maxAttempts: number;
    backoffMs: number;
    nextRunAt: string | null;
  }): void {
    this.db
      .query(
        `INSERT INTO plugin_job_definitions
           (job_id, plugin_id, schedule_expr, interval_ms, concurrency, timeout_ms,
            max_attempts, backoff_ms, next_run_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (job_id, plugin_id) DO UPDATE SET
           schedule_expr = excluded.schedule_expr,
           interval_ms = excluded.interval_ms,
           concurrency = excluded.concurrency,
           timeout_ms = excluded.timeout_ms,
           max_attempts = excluded.max_attempts,
           backoff_ms = excluded.backoff_ms,
           next_run_at = CASE
             WHEN plugin_job_definitions.schedule_expr IS excluded.schedule_expr
               AND plugin_job_definitions.interval_ms IS excluded.interval_ms
              THEN plugin_job_definitions.next_run_at
             ELSE excluded.next_run_at
           END`,
      )
      .run(
        definition.jobId,
        definition.pluginId,
        definition.scheduleExpr,
        definition.intervalMs,
        definition.concurrency,
        definition.timeoutMs,
        definition.maxAttempts,
        definition.backoffMs,
        definition.nextRunAt,
        this.stamp(),
      );
  }

  /** Drops a plugin's definitions and stops anything queued for them. */
  removePlugin(pluginId: string): void {
    this.db
      .query(
        `UPDATE plugin_job_runs
            SET status = 'cancelled', finished_at = ?, updated_at = ?,
                lease_owner = NULL, lease_expires_at = NULL
          WHERE plugin_id = ? AND status IN ('queued', 'running')`,
      )
      .run(this.stamp(), this.stamp(), pluginId);
    this.db
      .query("DELETE FROM plugin_job_definitions WHERE plugin_id = ?")
      .run(pluginId);
  }

  /** Drops one removed definition and cancels any runs it still owns. */
  removeJob(jobId: string, pluginId: string): void {
    this.db
      .query(
        `UPDATE plugin_job_runs
            SET status = 'cancelled', finished_at = ?, updated_at = ?,
                lease_owner = NULL, lease_expires_at = NULL
          WHERE job_id = ? AND plugin_id = ? AND status IN ('queued', 'running')`,
      )
      .run(this.stamp(), this.stamp(), jobId, pluginId);
    this.db
      .query(
        "DELETE FROM plugin_job_definitions WHERE job_id = ? AND plugin_id = ?",
      )
      .run(jobId, pluginId);
  }

  definitions(): JobDefinitionRow[] {
    return (
      this.db
        .query(
          `SELECT job_id, plugin_id, schedule_expr, interval_ms, concurrency, timeout_ms,
                  max_attempts, backoff_ms, next_run_at, last_run_at, created_at
             FROM plugin_job_definitions ORDER BY job_id`,
        )
        .all() as unknown as Record<string, unknown>[]
    ).map(toDefinition);
  }

  /**
   * Enqueues a run, or returns the existing one for a repeated idempotency key.
   *
   * A key reused with a different payload is refused: the caller believes it is
   * retrying one request, and running the second payload under the first key
   * would overwrite the first result while both report success.
   */
  enqueue(request: {
    jobId: string;
    pluginId: string;
    input: unknown;
    maxAttempts: number;
    idempotencyKey?: string;
    scheduledFor?: Date;
    coalesce?: boolean;
  }): { run: JobRunRow; created: boolean } {
    return this.db
      .transaction(() => {
        const stamp = this.stamp();
        const requestHash = hashRequest(request.input);
        if (request.coalesce) {
          const existing = this.db
            .query(
              `SELECT ${RUN_COLUMNS} FROM plugin_job_runs WHERE plugin_id = ? AND job_id = ? AND input_json = ? AND status IN ('queued', 'running') LIMIT 1`,
            )
            .get(
              request.pluginId,
              request.jobId,
              JSON.stringify(request.input ?? null),
            );
          if (existing)
            return {
              run: toRun(existing as Record<string, unknown>),
              created: false,
            };
        }
        if (request.idempotencyKey) {
          const existing = this.db
            .query(
              `SELECT ${RUN_COLUMNS} FROM plugin_job_runs
            WHERE plugin_id = ? AND job_id = ? AND idempotency_key = ?`,
            )
            .get(request.pluginId, request.jobId, request.idempotencyKey) as
            | Record<string, unknown>
            | undefined;
          if (existing) {
            const run = toRun(existing);
            if (run.requestHash !== requestHash) {
              throw new Error(
                `Idempotency key "${request.idempotencyKey}" was already used for a different payload`,
              );
            }
            return { run, created: false };
          }
        }
        const runId = randomUUID();
        this.db
          .query(
            `INSERT INTO plugin_job_runs
           (run_id, job_id, plugin_id, status, input_json, attempt_count,
            max_attempts, idempotency_key, request_hash, scheduled_for,
            enqueued_at, updated_at)
         VALUES (?, ?, ?, 'queued', ?, 0, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            runId,
            request.jobId,
            request.pluginId,
            JSON.stringify(request.input ?? null),
            request.maxAttempts,
            request.idempotencyKey ?? null,
            requestHash,
            request.scheduledFor?.toISOString() ?? null,
            stamp,
            stamp,
          );
        const created = this.getRun(runId)!;
        return { run: created, created: true };
      })
      .immediate();
  }

  getRun(runId: string): JobRunRow | null {
    const row = this.db
      .query(`SELECT ${RUN_COLUMNS} FROM plugin_job_runs WHERE run_id = ?`)
      .get(runId) as Record<string, unknown> | undefined;
    return row ? toRun(row) : null;
  }

  listRuns(
    filter: { pluginId?: string; jobId?: string; limit?: number } = {},
  ): JobRunRow[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.pluginId) {
      clauses.push("plugin_id = ?");
      params.push(filter.pluginId);
    }
    if (filter.jobId) {
      clauses.push("job_id = ?");
      params.push(filter.jobId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(Math.min(Math.max(filter.limit ?? 50, 1), 200));
    return (
      this.db
        .query(
          `SELECT ${RUN_COLUMNS} FROM plugin_job_runs ${where}
            ORDER BY enqueued_at DESC LIMIT ?`,
        )
        .all(...(params as never[])) as unknown as Record<string, unknown>[]
    ).map(toRun);
  }

  /**
   * Atomically takes one runnable run, or null when there is nothing to do.
   *
   * `singleton` jobs never overlap: one run per job at a time. `per-key` jobs
   * may overlap as long as their inputs differ, so the comparison is on the
   * payload. Both are enforced in the same transaction as the claim, which is
   * what stops two workers both deciding a job is free.
   */
  claim(owner: string): JobRunRow | null {
    const claim = this.db.transaction((): JobRunRow | null => {
      const candidates = this.db
        .query(
          `SELECT ${RUN_COLUMNS} FROM plugin_job_runs
            WHERE status = 'queued' AND cancel_requested = 0
              AND (scheduled_for IS NULL OR scheduled_for <= ?)
            ORDER BY enqueued_at ASC LIMIT 20`,
        )
        .all(this.stamp()) as unknown as Record<string, unknown>[];
      for (const candidate of candidates) {
        const run = toRun(candidate);
        if (!this.allowedByConcurrency(run)) continue;
        const expires = new Date(
          this.now().getTime() + this.leaseMs,
        ).toISOString();
        const updated = this.db
          .query(
            `UPDATE plugin_job_runs
                SET status = 'running', lease_owner = ?, lease_expires_at = ?,
                    started_at = COALESCE(started_at, ?),
                    attempt_count = attempt_count + 1, updated_at = ?
              WHERE run_id = ? AND status = 'queued'`,
          )
          .run(owner, expires, this.stamp(), this.stamp(), run.runId);
        if (updated.changes === 0) continue;
        this.db
          .query(
            `INSERT INTO plugin_job_attempts (run_id, attempt, status, started_at)
             VALUES (?, ?, 'running', ?)
             ON CONFLICT (run_id, attempt) DO NOTHING`,
          )
          .run(run.runId, run.attemptCount + 1, this.stamp());
        return this.getRun(run.runId);
      }
      return null;
    });
    return claim();
  }

  /** Only running jobs hold concurrency slots; queued siblings must remain claimable. */
  private allowedByConcurrency(run: JobRunRow): boolean {
    const definition = this.definition(run.jobId, run.pluginId);
    if (!definition) return false;
    if (definition.concurrency === "singleton") {
      const active = this.db
        .query(
          `SELECT count(*) AS n FROM plugin_job_runs
            WHERE job_id = ? AND plugin_id = ? AND status = 'running'
              AND run_id <> ?`,
        )
        .get(run.jobId, run.pluginId, run.runId) as { n: number };
      return Number(active?.n ?? 0) === 0;
    }
    // per-key: a different payload may run alongside this one.
    const sameInput = this.db
      .query(
        `SELECT count(*) AS n FROM plugin_job_runs
          WHERE job_id = ? AND plugin_id = ? AND status = 'running'
            AND input_json = ? AND run_id <> ?`,
      )
      .get(run.jobId, run.pluginId, run.inputJson, run.runId) as { n: number };
    return Number(sameInput?.n ?? 0) === 0;
  }

  definition(jobId: string, pluginId: string): JobDefinitionRow | null {
    const row = this.db
      .query(
        `SELECT job_id, plugin_id, schedule_expr, interval_ms, concurrency, timeout_ms,
                max_attempts, backoff_ms, next_run_at, last_run_at, created_at
           FROM plugin_job_definitions WHERE job_id = ? AND plugin_id = ?`,
      )
      .get(jobId, pluginId) as Record<string, unknown> | undefined;
    return row ? toDefinition(row) : null;
  }

  /**
   * Extends a lease so a long-running job is not reclaimed while it works.
   *
   * Returns false when the lease is gone, which means the run was reclaimed and
   * the caller must stop: its result would be discarded anyway.
   */
  renew(runId: string, owner: string): boolean {
    const expires = new Date(this.now().getTime() + this.leaseMs).toISOString();
    const updated = this.db
      .query(
        `UPDATE plugin_job_runs
            SET lease_expires_at = ?, updated_at = ?
          WHERE run_id = ? AND lease_owner = ? AND status = 'running'`,
      )
      .run(expires, this.stamp(), runId, owner);
    return updated.changes > 0;
  }

  /** Persist that an attempt may have performed an external side effect. */
  markSideEffect(runId: string, owner: string): boolean {
    const updated = this.db
      .query(
        `UPDATE plugin_job_runs SET outcome_unknown = 1, updated_at = ?
          WHERE run_id = ? AND lease_owner = ? AND status = 'running'`,
      )
      .run(this.stamp(), runId, owner);
    return updated.changes > 0;
  }

  /** Terminal success. Only the lease holder may write it. */
  succeed(runId: string, owner: string): boolean {
    const finished = this.stamp();
    const updated = this.db
      .query(
        `UPDATE plugin_job_runs
            SET status = 'succeeded', finished_at = ?, updated_at = ?,
                lease_owner = NULL, lease_expires_at = NULL, last_error = NULL
          WHERE run_id = ? AND lease_owner = ? AND status = 'running'`,
      )
      .run(finished, finished, runId, owner);
    if (updated.changes > 0) this.finishAttempt(runId, "succeeded", null);
    return updated.changes > 0;
  }

  /**
   * Terminal failure, or a queued retry when attempts remain.
   *
   * `outcomeUnknown` marks the case where the job may have had an external
   * effect before failing: a timed-out run cannot be retried safely on its own,
   * because the side effect may already have happened and repeating it would
   * double it. Such a run fails and waits for a caller who knows the provider's
   * idempotency guarantee.
   */
  fail(
    runId: string,
    owner: string,
    error: string,
    options: { outcomeUnknown?: boolean; retryAt?: Date } = {},
  ): JobRunRow | null {
    const stamp = this.stamp();
    const finish = this.db.transaction((): JobRunRow | null => {
      const updated = this.db
        .query(
          `UPDATE plugin_job_runs
              SET status = CASE WHEN cancel_requested = 1 THEN 'cancelled' ELSE ? END,
                  finished_at = ?, updated_at = ?, last_error = ?,
                  outcome_unknown = ?, lease_owner = NULL, lease_expires_at = NULL
            WHERE run_id = ? AND lease_owner = ? AND status = 'running'`,
        )
        .run(
          "failed",
          stamp,
          stamp,
          error,
          options.outcomeUnknown ? 1 : 0,
          runId,
          owner,
        );
      if (updated.changes === 0) return null;
      const run = this.getRun(runId)!;
      this.finishAttempt(runId, run.status, error);
      return run;
    });
    const failed = finish();
    if (!failed) return null;
    if (failed.status !== "failed") return failed;
    if (
      !options.outcomeUnknown &&
      failed.attemptCount < failed.maxAttempts &&
      options.retryAt
    )
      this.requeue(runId, options.retryAt);
    return this.getRun(runId);
  }

  /** Puts a failed run back in the queue for a later attempt. */
  requeue(runId: string, scheduledFor: Date): boolean {
    const updated = this.db
      .query(
        `UPDATE plugin_job_runs
            SET status = 'queued', scheduled_for = ?, finished_at = NULL,
                updated_at = ?
          WHERE run_id = ? AND status = 'failed'`,
      )
      .run(scheduledFor.toISOString(), this.stamp(), runId);
    return updated.changes > 0;
  }

  /** Marks a queued or running run cancelled. A running job sees the signal. */
  requestCancel(runId: string): boolean {
    const updated = this.db
      .query(
        `UPDATE plugin_job_runs
            SET cancel_requested = 1, updated_at = ?,
                status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
                finished_at = CASE WHEN status = 'queued' THEN ? ELSE finished_at END
          WHERE run_id = ? AND status IN ('queued', 'running')`,
      )
      .run(this.stamp(), this.stamp(), runId);
    return updated.changes > 0;
  }

  isCancelRequested(runId: string): boolean {
    const row = this.db
      .query("SELECT cancel_requested FROM plugin_job_runs WHERE run_id = ?")
      .get(runId) as { cancel_requested: number } | undefined;
    return Number(row?.cancel_requested ?? 0) === 1;
  }

  /**
   * Returns runs whose lease expired to the queue, so a crashed worker's work is
   * picked up rather than lost.
   *
   * The run goes back to `queued` only when it has attempts left; otherwise it
   * fails as unknown, because the attempt was started and may have had effects
   * nobody can observe.
   */
  reclaimExpiredLeases(): number {
    const stamp = this.stamp();
    const expired = this.db
      .query(
        `SELECT ${RUN_COLUMNS} FROM plugin_job_runs
          WHERE status = 'running'
            AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?`,
      )
      .all(stamp) as unknown as Record<string, unknown>[];
    let reclaimed = 0;
    for (const row of expired) {
      const run = toRun(row);
      const updated =
        run.attemptCount < run.maxAttempts && !run.outcomeUnknown
          ? this.db
              .query(
                `UPDATE plugin_job_runs
                    SET status = 'queued', lease_owner = NULL,
                        lease_expires_at = NULL, scheduled_for = ?, updated_at = ?,
                        last_error = 'Lease expired; reclaimed after a restart'
                  WHERE run_id = ? AND status = 'running' AND lease_owner = ?`,
              )
              .run(stamp, stamp, run.runId, run.leaseOwner)
          : this.db
              .query(
                `UPDATE plugin_job_runs
                    SET status = 'failed', finished_at = ?, updated_at = ?,
                        outcome_unknown = 1,
                        last_error = 'Lease expired with no attempts left',
                        lease_owner = NULL, lease_expires_at = NULL
                  WHERE run_id = ? AND status = 'running' AND lease_owner = ?`,
              )
              .run(stamp, stamp, run.runId, run.leaseOwner);
      if (updated.changes > 0) {
        reclaimed += 1;
        this.finishAttempt(run.runId, "failed", "Lease expired");
      }
    }
    return reclaimed;
  }

  /** Purges finished runs older than the retention window. */
  prune(retentionMs: number): number {
    const cutoff = new Date(this.now().getTime() - retentionMs).toISOString();
    const removed = this.db
      .query(
        `DELETE FROM plugin_job_runs
          WHERE status IN ('succeeded', 'failed', 'cancelled')
            AND finished_at IS NOT NULL AND finished_at < ?`,
      )
      .run(cutoff);
    this.db
      .query(
        `DELETE FROM plugin_job_attempts
          WHERE run_id NOT IN (SELECT run_id FROM plugin_job_runs)`,
      )
      .run();
    return removed.changes;
  }

  /** Definitions whose next run has arrived, so the scheduler can enqueue. */
  dueDefinitions(now: Date): JobDefinitionRow[] {
    return this.definitions().filter(
      (definition) =>
        (definition.scheduleExpr !== null || definition.intervalMs !== null) &&
        definition.nextRunAt !== null &&
        new Date(definition.nextRunAt).getTime() <= now.getTime(),
    );
  }

  /** Records the next due time after a schedule fired. */
  advanceSchedule(jobId: string, pluginId: string, nextRunAt: Date): void {
    this.db
      .query(
        `UPDATE plugin_job_definitions
            SET next_run_at = ?, last_run_at = ?
          WHERE job_id = ? AND plugin_id = ?`,
      )
      .run(nextRunAt.toISOString(), this.stamp(), jobId, pluginId);
  }

  attempts(runId: string): JobAttemptRow[] {
    return (
      this.db
        .query(
          `SELECT run_id, attempt, status, error, logs, artifacts, started_at, finished_at
             FROM plugin_job_attempts WHERE run_id = ? ORDER BY attempt`,
        )
        .all(runId) as unknown as Record<string, unknown>[]
    ).map(toAttempt);
  }

  /** Appends to the attempt's bounded log buffer. */
  appendAttemptLog(runId: string, attempt: number, line: string): void {
    this.db
      .query(
        `UPDATE plugin_job_attempts SET logs = substr(COALESCE(logs || char(10), '') || ?, -16000)
          WHERE run_id = ? AND attempt = ?`,
      )
      .run(line, runId, attempt);
  }

  private finishAttempt(
    runId: string,
    status: JobRunStatus,
    error: string | null,
  ): void {
    const run = this.getRun(runId);
    if (!run) return;
    this.db
      .query(
        `UPDATE plugin_job_attempts
            SET status = ?, error = ?, finished_at = ?
          WHERE run_id = ? AND attempt = ?`,
      )
      .run(status, error, this.stamp(), runId, run.attemptCount);
  }
}
