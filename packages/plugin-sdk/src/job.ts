/**
 * `defineJob`: a durable unit of work contributed by a plugin.
 *
 * A job is what replaces an ad-hoc timer. A plugin that samples every second
 * today runs `setInterval` in the host process, which means the work stops at
 * a restart, leaves no record of whether it ran, and cannot be retried or
 * inspected. A job is enqueued, leased, retried and recorded, so the same work
 * survives a restart and leaves an audit trail.
 *
 * The context a job receives is the plugin's own capabilities and a logger
 * scoped to its id — never the host's HTTP layer or a host database handle. A
 * job runs outside any request, so request-dependent services are unavailable.
 */
import type { z } from "zod";
import type {
  PluginCapabilities,
  PluginServiceCatalog,
  PluginStorage,
  PluginStores,
} from "./index.js";

/**
 * How many runs of one job may exist at once.
 *
 * `singleton` is for work that would contradict itself if it ran twice over the
 * same state. `per-key` allows concurrent runs as long as their inputs differ,
 * which is what per-row work wants.
 */
export type JobConcurrency = "singleton" | "per-key";

export interface JobRetry {
  /** Total attempts, including the first; `maxAttempts: 3` allows two retries. */
  maxAttempts: number;
  /** First retry delay; later attempts scale it and add jitter. */
  backoffMs: number;
}

/** What a job is given when it runs. */
export interface JobContext extends PluginCapabilities {
  /** The plugin's id, for logs and for namespacing anything it writes. */
  readonly pluginId: string;
  readonly config: Readonly<unknown>;
  readonly services: PluginServiceCatalog;
  readonly storage: PluginStorage;
  readonly stores: PluginStores;
  /** Scoped logger; output is recorded against the run and never global. */
  readonly logger: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
  /**
   * Aborted on timeout and on cancel.
   *
   * A job that ignores it will keep running until it finishes; nothing can
   * force a job to stop, so the signal is the only channel and the worker
   * records a timeout regardless of what the job went on to do.
   */
  readonly signal: AbortSignal;
  /**
   * Whether an external side effect may already have happened.
   *
   * Set this before an effect that cannot be undone. A run that times out or
   * loses its lease after that point is not retried automatically, because the
   * retry could double an effect nobody can see. Leaving it false means the
   * worker may retry freely.
   */
  reportSideEffect(): void;
}

export interface JobRunInput {
  readonly input: unknown;
  readonly context: JobContext;
  readonly runId: string;
}

export interface JobDefinition<
  TInputSchema extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
> {
  readonly kind: "job";
  readonly id: string;
  readonly inputSchema?: TInputSchema;
  /** Five-field cron in UTC. Absent means the job runs only when enqueued. */
  readonly schedule?: string;
  /** Fixed interval in milliseconds. Use for sub-minute recurring work. */
  readonly intervalMs?: number;
  /** Fully qualified adapter signal ids that enqueue this job. */
  readonly onSignals?: readonly string[];
  readonly concurrency: JobConcurrency;
  readonly timeoutMs: number;
  readonly retry: JobRetry;
  readonly run: (run: JobRunInput) => Promise<void> | void;
}

export interface DefineJobOptions<
  TInputSchema extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
> {
  id: string;
  inputSchema?: TInputSchema;
  /** Five-field cron in UTC, e.g. every five minutes as `"0-59/5 * * * *"`. */
  schedule?: string;
  /** Fixed interval in milliseconds; mutually exclusive with `schedule`. */
  intervalMs?: number;
  /** Enqueue this job when any fully qualified adapter signal is published. */
  onSignals?: readonly string[];
  /** Defaults to `"singleton"`. */
  concurrency?: JobConcurrency;
  /** Abort the run after this long. Defaults to 5 minutes. */
  timeoutMs?: number;
  /** Defaults to a single attempt with no retry. */
  retry?: Partial<JobRetry>;
  run: (run: JobRunInput) => Promise<void> | void;
}

export class InvalidJobDefinitionError extends Error {}

const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * Declares a job.
 *
 * Everything checkable without running is checked here so a mistake is a load
 * error rather than a job that silently never fires: an id the host would
 * namespace twice, a timeout that would fire before the job can start.
 */
export function defineJob<
  TInputSchema extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
>(options: DefineJobOptions<TInputSchema>): JobDefinition<TInputSchema> {
  if (!/^[a-z][a-z0-9-]*$/.test(options.id))
    throw new InvalidJobDefinitionError(
      `Job id must be kebab-case, found "${options.id}"`,
    );
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1)
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" timeout must be a positive integer`,
    );
  const retry = {
    maxAttempts: options.retry?.maxAttempts ?? 1,
    backoffMs: options.retry?.backoffMs ?? 1_000,
  };
  if (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1)
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" retry.maxAttempts must be at least 1`,
    );
  if (!Number.isInteger(retry.backoffMs) || retry.backoffMs < 0)
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" retry.backoffMs must not be negative`,
    );
  if (retry.maxAttempts > 1 && retry.backoffMs < 1)
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" retries without a backoff would spin on a failing job`,
    );
  if (options.schedule !== undefined && options.intervalMs !== undefined)
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" cannot set both schedule and intervalMs`,
    );
  if (
    options.intervalMs !== undefined &&
    (!Number.isInteger(options.intervalMs) || options.intervalMs < 250)
  )
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" intervalMs must be an integer of at least 250`,
    );
  if (options.onSignals !== undefined) {
    if (
      options.onSignals.length === 0 ||
      options.onSignals.some(
        (signalId) => !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(signalId),
      )
    )
      throw new InvalidJobDefinitionError(
        `Job "${options.id}" onSignals must contain qualified ids like "airflow.dag-failed"`,
      );
    if (new Set(options.onSignals).size !== options.onSignals.length)
      throw new InvalidJobDefinitionError(
        `Job "${options.id}" onSignals cannot contain duplicates`,
      );
  }
  return {
    kind: "job",
    id: options.id,
    ...(options.inputSchema ? { inputSchema: options.inputSchema } : {}),
    ...(options.schedule !== undefined ? { schedule: options.schedule } : {}),
    ...(options.intervalMs !== undefined
      ? { intervalMs: options.intervalMs }
      : {}),
    ...(options.onSignals ? { onSignals: [...options.onSignals] } : {}),
    concurrency: options.concurrency ?? "singleton",
    timeoutMs,
    retry,
    run: options.run as JobDefinition["run"],
  };
}
