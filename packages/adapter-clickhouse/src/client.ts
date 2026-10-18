import type { ClickHouseConfig } from "./config.js";
import { requestError } from "./errors.js";
import { MAX_BYTES, ResultError, readResponse } from "./result.js";
import { quoteIdentifier, validateSql } from "./sql.js";
import { createDriver } from "./transport.js";

export { parseResult } from "./result.js";
export type Row = Record<string, unknown>;
export interface QueryResult {
  columns: string[];
  columnTypes: string[];
  rows: Row[];
  rowCount: number;
  queryId: string;
}
export interface ExecuteOptions {
  database?: string;
  maxRows?: number;
  signal?: AbortSignal;
  params?: Record<string, unknown>;
}
export interface ClickHouseClient {
  execute(sql: string, options?: ExecuteOptions): Promise<QueryResult>;
  cancel(queryId: string): Promise<Row[]>;
  dispose(): Promise<void>;
}

class ClickHouseConnection implements ClickHouseClient {
  private readonly client;
  private readonly control;
  private readonly active = new Map<string, AbortController>();
  private disposed = false;
  constructor(private readonly config: ClickHouseConfig) {
    this.client = createDriver(config, false);
    this.control = createDriver(config, true);
  }
  private checkRequest(sql: string, options: ExecuteOptions) {
    if (this.disposed)
      throw new Error("ClickHouse connection has been disposed.");
    validateSql(sql);
    const database = options.database ?? this.config.database;
    if (
      this.config.databaseScope === "selected" &&
      database !== this.config.database
    )
      throw new Error("Database is outside the configured browsing scope.");
    const maxRows = options.maxRows ?? 1000;
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10_000)
      throw new Error("Row limit must be between 1 and 10000.");
    options.signal?.throwIfAborted();
    return { database, maxRows };
  }
  async execute(
    sql: string,
    options: ExecuteOptions = {},
  ): Promise<QueryResult> {
    const { database, maxRows } = this.checkRequest(sql, options);
    const queryId = crypto.randomUUID();
    const controller = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    this.active.set(queryId, controller);
    try {
      const result = await this.client.exec({
        query: sql,
        query_id: queryId,
        query_params: options.params,
        abort_signal: signal,
        clickhouse_settings: {
          database,
          max_result_rows: String(maxRows),
          max_result_bytes: String(MAX_BYTES),
          result_overflow_mode: "throw",
        },
      });
      return await readResponse(result.stream, queryId, maxRows, signal);
    } catch (error) {
      if (signal.aborted) {
        // Disconnecting alone does not guarantee server termination.
        await this.control
          .command({
            query: "KILL QUERY WHERE query_id = {id:String} ASYNC",
            query_params: { id: queryId },
          })
          .catch(() => undefined);
        throw new Error(
          "Query interrupted; server termination could not be confirmed. Inspect Activity before retrying a write.",
        );
      }
      if (error instanceof SyntaxError)
        throw new Error(
          "ClickHouse returned an incomplete or non-JSON result; the statement may have failed after response headers.",
        );
      if (error instanceof ResultError) throw error;
      throw requestError(error);
    } finally {
      this.active.delete(queryId);
    }
  }
  async cancel(queryId: string): Promise<Row[]> {
    if (this.disposed)
      throw new Error("ClickHouse connection has been disposed.");
    try {
      const result = await this.control.query({
        query: "KILL QUERY WHERE query_id = {id:String} SYNC",
        query_params: { id: queryId },
        format: "JSONEachRow",
      });
      try {
        return await result.json<Row>();
      } finally {
        result.close();
      }
    } catch {
      throw new Error(
        "ClickHouse could not confirm cancellation. Check query visibility and KILL QUERY permission.",
      );
    }
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    for (const controller of this.active.values()) controller.abort();
    await Promise.allSettled([this.client.close(), this.control.close()]);
    this.active.clear();
  }
}
export function createClickHouseClient(
  config: ClickHouseConfig,
): ClickHouseClient {
  return new ClickHouseConnection(config);
}
export function qualified(database: string, table: string) {
  return `${quoteIdentifier(database)}.${quoteIdentifier(table)}`;
}
