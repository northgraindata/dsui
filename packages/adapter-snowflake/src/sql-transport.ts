import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type { QueryResult, SnowflakeConfig } from "./context.js";

export interface StatementOptions {
  warehouse?: string | null;
  database?: string | null;
  schema?: string | null;
  role?: string | null;
  signal?: AbortSignal;
}

/** Fixed defaults also apply to direct client consumers, outside the host. */
export interface TransportLimits {
  timeoutMs: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
  maxRows: number;
  maxBytes: number;
  maxPartitions: number;
}

const defaults: TransportLimits = {
  timeoutMs: 60_000,
  pollIntervalMs: 250,
  maxPollAttempts: 240,
  maxRows: 10_000,
  maxBytes: 16 * 1024 * 1024,
  maxPartitions: 100,
};
const dataSchema = z.array(z.array(z.string().nullable()));
const pendingSchema = z.object({ statementHandle: z.string().min(1) });
const resultSchema = z.object({
  statementHandle: z.string().min(1).optional(),
  resultSetMetaData: z.object({
    numRows: z.number().int().nonnegative().optional(),
    rowType: z.array(z.object({ name: z.string() })),
    partitionInfo: z
      .array(
        z.object({
          rowCount: z.number().int().nonnegative(),
          uncompressedSize: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
  }),
  data: dataSchema,
});

export function createSqlTransport(
  config: SnowflakeConfig,
  fetchFn: typeof fetch,
  overrides: Partial<TransportLimits> = {},
) {
  const limits = { ...defaults, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`Invalid Snowflake transport limit: ${name}`);
  }
  const base = new URL(
    config.host ?? `https://${config.accountIdentifier}.snowflakecomputing.com`,
  );
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error(
      "Snowflake host must be an HTTPS origin without credentials",
    );
  const headers = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "dsui-snowflake/0.2",
  };
  const lifetime = new AbortController();

  async function statement(
    sql: string,
    values: readonly (string | number | boolean | null)[] = [],
    options: StatementOptions = {},
  ): Promise<QueryResult> {
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), limits.timeoutMs);
    const signal = AbortSignal.any([
      lifetime.signal,
      deadline.signal,
      ...(options.signal ? [options.signal] : []),
    ]);
    let handle: string | undefined;
    let bytes = 0;

    async function request(path: string, init: RequestInit = {}) {
      signal.throwIfAborted();
      const response = await fetchFn(new URL(path, base), {
        ...init,
        headers,
        signal,
        redirect: "error",
      });
      if (
        response.status !== 200 &&
        response.status !== 202 &&
        response.status !== 429
      ) {
        await response.body?.cancel();
        throw new Error(`Snowflake request failed (HTTP ${response.status})`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Invalid Snowflake response");
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          signal.throwIfAborted();
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > limits.maxBytes)
            throw new Error("Snowflake response exceeds byte limit");
          length += chunk.value.byteLength;
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
      const buffer = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(buffer));
      } catch {
        throw new Error("Invalid Snowflake JSON response");
      }
      return { status: response.status, body };
    }

    try {
      const bindings = Object.fromEntries(
        values.map((value, index) => [
          String(index + 1),
          {
            type:
              typeof value === "number"
                ? Number.isInteger(value)
                  ? "FIXED"
                  : "REAL"
                : typeof value === "boolean"
                  ? "BOOLEAN"
                  : "TEXT",
            value: value === null ? null : String(value),
          },
        ]),
      );
      const context = Object.fromEntries(
        (["warehouse", "database", "schema", "role"] as const)
          .map((key) => [key, options[key] ?? config[key]])
          .filter(([, value]) => value !== undefined),
      );
      let response = await request(
        `/api/v2/statements?requestId=${randomUUID()}`,
        {
          method: "POST",
          body: JSON.stringify({
            statement: sql,
            timeout: Math.max(1, Math.floor(limits.timeoutMs / 1000)),
            parameters: { MULTI_STATEMENT_COUNT: "1" },
            ...context,
            ...(values.length ? { bindings } : {}),
          }),
        },
      );
      let polls = 0;
      while (response.status === 202 || response.status === 429) {
        const pending = pendingSchema.safeParse(response.body);
        if (!pending.success)
          throw new Error("Invalid Snowflake pending response");
        if (handle && handle !== pending.data.statementHandle)
          throw new Error("Snowflake statement handle changed");
        handle = pending.data.statementHandle;
        if (polls++ >= limits.maxPollAttempts)
          throw new Error("Snowflake statement polling limit exceeded");
        await delay(limits.pollIntervalMs, undefined, { signal });
        response = await request(
          `/api/v2/statements/${encodeURIComponent(handle)}`,
        );
      }
      const parsed = resultSchema.safeParse(response.body);
      if (!parsed.success) throw new Error("Invalid Snowflake result response");
      const result = parsed.data;
      if (handle && result.statementHandle && handle !== result.statementHandle)
        throw new Error("Snowflake statement handle changed");
      handle = result.statementHandle ?? handle;
      const metadata = result.resultSetMetaData;
      const partitions = metadata.partitionInfo ?? [];
      if (partitions.length > limits.maxPartitions)
        throw new Error("Snowflake result exceeds partition limit");
      if (
        (metadata.numRows ?? 0) > limits.maxRows ||
        partitions.reduce((sum, p) => sum + p.rowCount, 0) > limits.maxRows
      )
        throw new Error("Snowflake result exceeds row limit; narrow the query");
      const columns = metadata.rowType.map((column) => column.name);
      if (new Set(columns).size !== columns.length)
        throw new Error("Duplicate result columns; use unique SQL aliases");
      const rows: Record<string, unknown>[] = [];
      function append(data: (string | null)[][], expected?: number) {
        if (expected !== undefined && data.length !== expected)
          throw new Error("Incomplete Snowflake result partition");
        if (rows.length + data.length > limits.maxRows)
          throw new Error(
            "Snowflake result exceeds row limit; narrow the query",
          );
        for (const row of data) {
          if (row.length !== columns.length)
            throw new Error("Invalid Snowflake result row width");
          rows.push(
            Object.fromEntries(
              columns.map((column, index) => [column, row[index]]),
            ),
          );
        }
      }
      append(result.data, partitions[0]?.rowCount);
      for (let index = 1; index < partitions.length; index++) {
        if (!handle) throw new Error("Missing Snowflake partition handle");
        const partition = await request(
          `/api/v2/statements/${encodeURIComponent(handle)}?partition=${index}`,
        );
        const parsedPartition = z
          .object({ data: dataSchema })
          .safeParse(partition.body);
        if (partition.status !== 200 || !parsedPartition.success)
          throw new Error("Invalid Snowflake partition response");
        append(parsedPartition.data.data, partitions[index]?.rowCount);
      }
      if (metadata.numRows !== undefined && rows.length !== metadata.numRows)
        throw new Error("Incomplete Snowflake result");
      return { columns, rows };
    } catch (error) {
      if (
        handle &&
        (signal.aborted ||
          (error instanceof Error && error.message.includes("polling limit")))
      ) {
        // Do not reuse the aborted request signal. Cancellation is best effort.
        try {
          const response = await fetchFn(
            new URL(
              `/api/v2/statements/${encodeURIComponent(handle)}/cancel`,
              base,
            ),
            {
              method: "POST",
              headers,
              redirect: "error",
              signal: AbortSignal.timeout(5_000),
            },
          );
          await response.body?.cancel();
        } catch {
          /* The original failure remains authoritative. */
        }
      }
      if (signal.aborted)
        throw new Error(
          deadline.signal.aborted
            ? "Snowflake request timed out"
            : "Snowflake request aborted",
        );
      if (
        error instanceof Error &&
        config.token &&
        error.message.includes(config.token)
      )
        error.message = error.message.split(config.token).join("[redacted]");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  return { statement, dispose: () => lifetime.abort() };
}
