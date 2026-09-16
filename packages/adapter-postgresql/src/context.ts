import { z } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLClient } from "./client.js";

export const postgresqlConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535).default(5432),
  database: z.string().min(1),
  databaseScope: z.enum(["all", "selected"]).default("all"),
  username: z.string().min(1),
  password: z.string().min(1).optional(),
  sslMode: z
    .enum(["disable", "prefer", "require", "verify-ca", "verify-full"])
    .default("prefer"),
  sslRootCert: z.string().min(1).optional(),
  sslCert: z.string().min(1).optional(),
  sslKey: z.string().min(1).optional(),
  connectTimeout: z.number().int().positive().default(10),
  statementTimeout: z.number().int().positive().default(60_000),
  applicationName: z.string().min(1).default("dsui"),
});

export type PostgreSQLConfig = z.output<typeof postgresqlConnectionSchema>;

export interface PostgreSQLContext {
  client: PostgreSQLClient;
  config: PostgreSQLConfig;
}

export function createPostgreSQLContext(
  client: PostgreSQLClient,
  config: PostgreSQLConfig,
): PostgreSQLContext {
  return { client, config };
}
