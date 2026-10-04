import { defineSignal, z } from "@northgraindata/dsui-adapter-sdk";

const queryPayload = z.object({
  operation: z.string(),
  database: z.string().optional(),
  durationMs: z.number().int().nonnegative(),
  rowCount: z.number().int().nonnegative().optional(),
  errorCode: z.string().optional(),
});

export const querySucceeded = defineSignal({
  id: "query-succeeded",
  type: "success",
  schema: queryPayload,
});

export const queryFailed = defineSignal({
  id: "query-failed",
  type: "error",
  schema: queryPayload,
});

export const postgresqlSignals = [querySucceeded, queryFailed] as const;
