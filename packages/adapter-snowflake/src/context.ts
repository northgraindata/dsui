import { z } from "@northgraindata/dsui-adapter-sdk";
import type { TtlCache } from "./cache.js";
import type { SnowflakeClient } from "./client.js";

const commonFields = {
  account: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  warehouse: z.string().min(1).optional(),
  database: z.string().min(1),
  schema: z.string().min(1).default("PUBLIC"),
  role: z.string().min(1).optional(),
  application: z.string().min(1).default("DSUI"),
  // Blocks every statement that changes Snowflake state (queries and commands).
  readOnly: z.boolean().default(false),
  statementTimeoutSeconds: z.number().int().min(1).max(86_400).default(60),
};

export const snowflakeJwtConnectionSchema = z.object({
  ...commonFields,
  method: z.literal("jwt"),
  username: z.string().min(1),
  privateKeyPath: z.string().min(1),
  privateKeyPass: z.string().optional(),
});

export const snowflakePasswordConnectionSchema = z.object({
  ...commonFields,
  method: z.literal("password"),
  username: z.string().min(1),
  password: z.string().min(1),
  passcode: z.string().optional(),
});

export type SnowflakeConfig =
  | z.output<typeof snowflakeJwtConnectionSchema>
  | z.output<typeof snowflakePasswordConnectionSchema>;

export interface SnowflakeContext {
  client: SnowflakeClient;
  /** Catalog reads are cached briefly; writes clear it. */
  cache: TtlCache;
  config: SnowflakeConfig;
  defaultWarehouse: string;
  getClient(warehouse: string): Promise<SnowflakeClient>;
  dispose(): Promise<void>;
}
