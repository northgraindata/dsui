import type { z } from "zod";
import type { AnySignalDefinition } from "./signal";

export type JobConcurrency = "singleton" | "per-key";

export interface JobRetry {
  readonly maxAttempts: number;
  readonly backoffMs: number;
}

export interface SignalEmission {
  readonly signalId: string;
  readonly payload: unknown;
  readonly idempotencyKey?: string;
}

export interface JobRunInput<
  TContext,
  TInputSchema extends z.ZodTypeAny | undefined = undefined,
> {
  readonly input: TInputSchema extends z.ZodTypeAny
    ? z.output<TInputSchema>
    : unknown;
  readonly context: TContext;
  readonly runId: string;
  readonly signal: AbortSignal;
  readonly emit: <TSignal extends AnySignalDefinition>(
    definition: TSignal,
    payload: z.output<TSignal["schema"]>,
    options?: { readonly idempotencyKey?: string },
  ) => void;
}

export interface JobDefinition<
  TContext = unknown,
  TInputSchema extends z.ZodTypeAny | undefined = undefined,
> {
  readonly kind: "job";
  readonly id: string;
  readonly inputSchema?: TInputSchema;
  readonly schedule?: string;
  readonly intervalMs?: number;
  readonly concurrency: JobConcurrency;
  readonly timeoutMs: number;
  readonly retry: JobRetry;
  readonly run: (
    run: JobRunInput<TContext, TInputSchema>,
  ) => Promise<void> | void;
}

/** Type-erased job definition used by adapter catalogs. */
export type AnyJobDefinition<TContext = unknown> = JobDefinition<
  TContext,
  z.ZodTypeAny | undefined
>;

export interface DefineJobOptions<
  TContext,
  TInputSchema extends z.ZodTypeAny | undefined = undefined,
> {
  readonly id: string;
  readonly inputSchema?: TInputSchema;
  /** Five-field cron expression in UTC. */
  readonly schedule?: string;
  /** Fixed interval in milliseconds. */
  readonly intervalMs?: number;
  readonly concurrency?: JobConcurrency;
  readonly timeoutMs?: number;
  readonly retry?: Partial<JobRetry>;
  readonly run: (
    run: JobRunInput<TContext, TInputSchema>,
  ) => Promise<void> | void;
}

export class InvalidJobDefinitionError extends Error {}

/** Declares scheduled work that runs for each configured adapter instance. */
export function defineJob<
  TContext,
  TInputSchema extends z.ZodTypeAny | undefined = undefined,
>(
  options: DefineJobOptions<TContext, TInputSchema>,
): JobDefinition<TContext, TInputSchema> {
  if (!/^[a-z][a-z0-9-]*$/.test(options.id))
    throw new InvalidJobDefinitionError(
      `Job id must be kebab-case, found "${options.id}"`,
    );
  if (options.schedule !== undefined && options.intervalMs !== undefined)
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" cannot set both schedule and intervalMs`,
    );
  if (options.schedule === undefined && options.intervalMs === undefined)
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" must set a schedule or intervalMs`,
    );
  if (
    options.intervalMs !== undefined &&
    (!Number.isInteger(options.intervalMs) || options.intervalMs < 250)
  )
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" intervalMs must be an integer of at least 250`,
    );
  const timeoutMs = options.timeoutMs ?? 300_000;
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
  if (
    !Number.isInteger(retry.backoffMs) ||
    retry.backoffMs < 0 ||
    (retry.maxAttempts > 1 && retry.backoffMs < 1)
  )
    throw new InvalidJobDefinitionError(
      `Job "${options.id}" requires a non-negative retry backoff, and retries need a positive backoff`,
    );
  return {
    kind: "job",
    id: options.id,
    ...(options.inputSchema ? { inputSchema: options.inputSchema } : {}),
    ...(options.schedule ? { schedule: options.schedule } : {}),
    ...(options.intervalMs !== undefined
      ? { intervalMs: options.intervalMs }
      : {}),
    concurrency: options.concurrency ?? "singleton",
    timeoutMs,
    retry,
    run: options.run,
  };
}
