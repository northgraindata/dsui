import type { Readable } from "node:stream";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type { QueryResult } from "./client.js";
export class ResultError extends Error {}
export const MAX_BYTES = 16 * 1024 * 1024;
const compactSchema = z.object({
  meta: z.array(z.object({ name: z.string(), type: z.string() })),
  data: z.array(z.array(z.unknown())),
  exception: z.string().optional(),
});

export function parseResult(
  body: string,
  queryId: string,
  maxRows: number,
): QueryResult {
  if (!body.trim())
    return { columns: [], columnTypes: [], rows: [], rowCount: 0, queryId };
  const parsed = compactSchema.safeParse(JSON.parse(body));
  if (!parsed.success)
    throw new ResultError("ClickHouse returned an unsupported result format.");
  if (parsed.data.exception)
    throw new ResultError(
      "ClickHouse reported an execution error after starting the response.",
    );
  if (parsed.data.data.length > maxRows)
    throw new ResultError(
      `Query exceeds the ${maxRows} row limit. Add LIMIT or narrow the query.`,
    );
  const used = new Set<string>();
  const columns = parsed.data.meta.map(({ name }) => {
    let key = name;
    let suffix = 2;
    while (used.has(key)) key = `${name} (${suffix++})`;
    used.add(key);
    return key;
  });
  const rows = parsed.data.data.map((values) => {
    if (values.length !== columns.length)
      throw new ResultError("ClickHouse returned a malformed result row.");
    return Object.fromEntries(
      columns.map((column, index) => [column, values[index]]),
    );
  });
  const result = {
    columns,
    columnTypes: parsed.data.meta.map(({ type }) => type),
    rows,
    rowCount: rows.length,
    queryId,
  };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_BYTES)
    throw new ResultError("Query result exceeds the 16 MiB response limit.");
  return result;
}

export async function readResponse(
  stream: Readable,
  queryId: string,
  maxRows: number,
  signal: AbortSignal,
) {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BYTES)
        throw new ResultError(
          "Query result exceeds the 16 MiB response limit.",
        );
      chunks.push(bytes);
    }
    signal.throwIfAborted();
    return parseResult(
      Buffer.concat(chunks).toString("utf8"),
      queryId,
      maxRows,
    );
  } finally {
    stream.destroy();
  }
}
