import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "./actions.js";
import { createSnowflakeClient } from "./client.js";
import {
  type SnowflakeConfig,
  type SnowflakeContext,
  snowflakeJwtConnectionSchema,
  snowflakePasswordConnectionSchema,
} from "./context.js";
import { snowflakeHealth } from "./health.js";
import { snowflakeIconUrl } from "./icon.js";
import {
  databasePage,
  dataPage,
  overviewPage,
  queryPage,
  relationPage,
  schemaPage,
  warehousesPage,
} from "./pages.js";
import {
  columns,
  databases,
  previewRows,
  relations,
  schemas,
  serverInfo,
  warehouses,
} from "./resources.js";

export function createSnowflakeAdapter(createClient = createSnowflakeClient) {
  return defineAdapter<SnowflakeContext, SnowflakeConfig>({
    metadata: {
      id: "snowflake",
      name: "Snowflake",
      version: "0.1.0",
      author: "DSUI",
      iconUrl: snowflakeIconUrl,
      description: "Browse Snowflake catalogs and run SQL queries.",
    },
    connectionMethods: {
      jwt: {
        label: "Key pair authentication (JWT)",
        description: "Authenticate with a private key file available to DSUI.",
        schema: snowflakeJwtConnectionSchema,
        contextIdleTimeoutMs: 300_000,
      },
      password: {
        label: "Password-based authentication",
        description:
          "Use a Snowflake password. Authenticator app MFA is not supported by this method.",
        schema: snowflakePasswordConnectionSchema,
        contextIdleTimeoutMs: 300_000,
      },
    },
    context: async (config) => {
      const client = await createClient(config);
      try {
        const visibleWarehouses = await client.listWarehouses();
        const defaultWarehouse = config.warehouse ?? visibleWarehouses[0]?.name;
        if (!defaultWarehouse) {
          throw new Error(
            "No warehouse is visible to the configured Snowflake role.",
          );
        }
        await client.selectWarehouse(defaultWarehouse);
        await client.serverInfo();
        const clients = new Map<string, Promise<typeof client>>([
          [defaultWarehouse, Promise.resolve(client)],
        ]);
        return {
          client,
          config,
          defaultWarehouse,
          getClient(warehouse: string) {
            const existing = clients.get(warehouse);
            if (existing) return existing;
            const next = createClient({ ...config, warehouse }).then(
              async (selected) => {
                try {
                  await selected.serverInfo();
                  return selected;
                } catch (error) {
                  await selected.dispose();
                  throw error;
                }
              },
            );
            clients.set(warehouse, next);
            next.catch(() => clients.delete(warehouse));
            return next;
          },
          async dispose() {
            const settled = await Promise.allSettled(clients.values());
            await Promise.all(
              settled.flatMap((result) =>
                result.status === "fulfilled" ? [result.value.dispose()] : [],
              ),
            );
            clients.clear();
          },
        };
      } catch (error) {
        await client.dispose();
        throw error;
      }
    },
    disposeContext: (ctx) => ctx.dispose(),
    latencyBudgetMs: 2_000,
    health: snowflakeHealth,
    resources: [
      serverInfo,
      databases,
      warehouses,
      schemas,
      relations,
      columns,
      previewRows,
    ],
    actions: [runQuery],
    pages: [
      overviewPage,
      dataPage,
      databasePage,
      schemaPage,
      relationPage,
      warehousesPage,
      queryPage,
    ],
  });
}

export const snowflakeAdapter = createSnowflakeAdapter();
export default snowflakeAdapter;
