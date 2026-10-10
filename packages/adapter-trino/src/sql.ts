import { z } from "@northgraindata/dsui-adapter-sdk";
export const objectSchema = z.record(z.unknown());
export type JsonObject = z.output<typeof objectSchema>;
export const resultsSchema = z.object({
  id: z.string(),
  nextUri: z.string().url().optional(),
  columns: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
  data: z.array(z.array(z.unknown())).optional(),
  error: z
    .object({
      message: z.string(),
      errorName: z.string().optional(),
      errorCode: z.number().optional(),
      errorLocation: z
        .object({ lineNumber: z.number(), columnNumber: z.number() })
        .optional(),
    })
    .passthrough()
    .optional(),
  warnings: z.array(objectSchema).optional(),
  updateType: z.string().optional(),
  updateCount: z.union([z.number(), z.string()]).optional(),
  stats: objectSchema.optional(),
});
export type ResultPage = z.output<typeof resultsSchema>;
export type QueryResult = {
  columns: string[];
  columnTypes: string[];
  rows: JsonObject[];
  rowCount: number;
  queryId: string;
  elapsedMs: number;
  truncated: boolean;
  warnings: JsonObject[];
  rowsChanged?: number | string;
  updateType?: string;
};
export function quote(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
export function literal(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
export function qualified(...names: string[]) {
  return names.map(quote).join(".");
}
export class TrinoError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "TrinoError";
  }
}
