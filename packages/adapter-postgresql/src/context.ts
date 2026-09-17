import { z } from "@northgraindata/dsui-adapter-sdk";
import { createPostgreSQLClient, type PostgreSQLClient } from "./client.js";

export const postgresqlConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65_535).default(5432),
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
  connectTimeout: z.coerce.number().int().positive().default(10),
  statementTimeout: z.coerce.number().int().positive().default(60_000),
  applicationName: z.string().min(1).default("dsui"),
});

export type PostgreSQLConfig = z.output<typeof postgresqlConnectionSchema>;

export interface PostgreSQLContext {
  client: PostgreSQLClient;
  config: PostgreSQLConfig;
  getClient(database: string): PostgreSQLClient;
  dispose(): Promise<void>;
}

export function createPostgreSQLContext(
  client: PostgreSQLClient,
  config: PostgreSQLConfig,
): PostgreSQLContext {
  const clients = new Map<string, PostgreSQLClient>([
    [config.database, client],
  ]);

  return {
    client,
    config,
    getClient(database) {
      const existing = clients.get(database);
      if (existing) return existing;
      const next = createPostgreSQLClient({ ...config, database });
      clients.set(database, next);
      return next;
    },
    async dispose() {
      await Promise.all(
        [...clients.values()].map((databaseClient) => databaseClient.dispose()),
      );
      clients.clear();
    },
  };
}
