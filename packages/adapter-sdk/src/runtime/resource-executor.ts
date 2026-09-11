import type { RefreshPolicy } from "../refresh/policy";
import { PollingRefreshPolicy } from "../refresh/polling";
import type { AnyResourceDefinition, ResourceBinding } from "../resource/index";
import type { ResourceResult } from "./types";

interface WatchedEntry {
  binding: ResourceBinding<unknown, unknown, unknown>;
  listeners: Set<(result: ResourceResult<unknown>) => void>;
  policy: RefreshPolicy | undefined;
  lastResult: ResourceResult<unknown> | undefined;
  executive: number;
}

/**
 * Owns resource execution for one adapter instance: one-shot runs,
 * watched bindings with runtime-managed refreshing, and invalidation.
 *
 * Watchers are keyed by resource id plus normalized input, so identical
 * bindings share one execution. The last unsubscribe stops the refresh
 * policy and drops the entry.
 */
export class ResourceExecutor<TContext> {
  private readonly watchers = new Map<string, WatchedEntry>();
  private disposed = false;

  /**
   * @param context - The instance context queries run against.
   */
  constructor(private readonly context: TContext) {}

  /**
   * Executes a binding once, returning success or error (never throws
   * for query failures).
   *
   * @param binding - The binding to execute.
   */
  async execute<TInput, TOutput>(
    binding: ResourceBinding<TInput, TOutput, never>,
  ): Promise<ResourceResult<TOutput>> {
    const query = binding.definition.query as (
      input: unknown,
      ctx: unknown,
    ) => Promise<unknown> | unknown;
    try {
      const data = (await query(binding.input, this.context)) as TOutput;
      return { status: "success", data };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Subscribes to a binding with immediate execution and background
   * refreshing per the resource's refresh strategy.
   *
   * @param binding - The binding to watch.
   * @param listener - Called with each result; the latest cached result
   * is delivered immediately on subscribe.
   * @returns Unsubscribe function; tears the execution down when the
   * last listener leaves.
   */
  watch<TInput, TOutput>(
    binding: ResourceBinding<TInput, TOutput, never>,
    listener: (result: ResourceResult<TOutput>) => void,
  ): () => void {
    const entry = this.ensureWatcher(
      binding as unknown as ResourceBinding<unknown, unknown, unknown>,
    );
    const wrapped = listener as (result: ResourceResult<unknown>) => void;
    entry.listeners.add(wrapped);
    if (entry.lastResult) wrapped(entry.lastResult);
    return () => {
      entry.listeners.delete(wrapped);
      if (entry.listeners.size === 0) {
        entry.policy?.stop();
        entry.executive++;
        this.watchers.delete(bindingKey(entry.binding));
      }
    };
  }

  /**
   * Re-executes watched bindings: none (all), a resource (its
   * bindings), or a resource plus input (one binding).
   *
   * @param resource - Resource to narrow invalidation to.
   * @param input - Binding input to narrow invalidation to.
   */
  invalidate(resource?: AnyResourceDefinition, input?: unknown): void {
    for (const entry of this.watchers.values()) {
      if (resource && entry.binding.resourceId !== resource.id) continue;
      if (resource && input !== undefined) {
        const normalized = normalizeInput({
          definition: entry.binding.definition,
          input,
        } as ResourceBinding<unknown, unknown, unknown>);
        if (
          stableStringify(normalized) !== stableStringify(entry.binding.input)
        )
          continue;
      }
      void this.run(entry);
    }
  }

  /** Stops all policies and drops every watcher. */
  dispose(): void {
    this.disposed = true;
    for (const entry of this.watchers.values()) {
      entry.policy?.stop();
      entry.executive++;
      entry.listeners.clear();
    }
    this.watchers.clear();
  }

  private ensureWatcher(
    binding: ResourceBinding<unknown, unknown, unknown>,
  ): WatchedEntry {
    const key = bindingKey(binding);
    const existing = this.watchers.get(key);
    if (existing) return existing;
    const refresh = binding.definition.refresh;
    const policy =
      refresh.kind === "poll"
        ? new PollingRefreshPolicy(refresh.intervalMs)
        : undefined;
    const entry: WatchedEntry = {
      binding,
      listeners: new Set(),
      policy,
      lastResult: undefined,
      executive: 0,
    };
    this.watchers.set(key, entry);
    if (!this.disposed && policy)
      policy.start(() => {
        void this.run(entry);
      });
    void this.run(entry);
    return entry;
  }

  private async run(entry: WatchedEntry): Promise<void> {
    const runId = ++entry.executive;
    try {
      const data = await entry.binding.definition.query(
        entry.binding.input,
        this.context,
      );
      if (this.disposed || runId !== entry.executive) return;
      const result: ResourceResult<unknown> = { status: "success", data };
      entry.lastResult = result;
      for (const listener of [...entry.listeners]) listener(result);
    } catch (error) {
      if (this.disposed || runId !== entry.executive) return;
      const result: ResourceResult<unknown> = {
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
      entry.lastResult = result;
      for (const listener of [...entry.listeners]) listener(result);
    }
  }
}

function bindingKey(
  binding: ResourceBinding<unknown, unknown, unknown>,
): string {
  return resourceKey(binding.resourceId, normalizeInput(binding));
}

function normalizeInput(
  binding: ResourceBinding<unknown, unknown, unknown>,
): unknown {
  const schema = binding.definition.inputSchema;
  if (schema && binding.input !== undefined) {
    try {
      return schema.parse(binding.input);
    } catch {
      return binding.input;
    }
  }
  return binding.input;
}

/**
 * Stable execution identity: resource id plus normalized input.
 * Key order and `undefined` fields do not affect the key.
 *
 * @example
 * ```ts
 * resourceKey("schemas", { database: "A" });
 * // 'schemas:{"database":"A"}'
 * ```
 */
export function resourceKey(resourceId: string, input: unknown): string {
  return `${resourceId}:${stableStringify(input)}`;
}

/**
 * Deterministic serialization with sorted keys, used for execution
 * identity. `undefined` fields are skipped; `undefined` itself
 * serializes as `"undefined"`.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}
