import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { actions, queryFailed, querySucceeded } from "./actions.js";
import { type ClickHouseClient, createClickHouseClient } from "./client.js";
import {
  type ClickHouseConfig,
  structuredSchema,
  urlSchema,
} from "./config.js";
import type { ClickHouseContext } from "./context.js";
import { clickhouseHealth } from "./health.js";
import { clickhouseIconUrl } from "./logo.js";
import { pages } from "./pages.js";
import { catalogResources } from "./resources.js";

export function createClickHouseAdapter(
  createClient: (
    config: ClickHouseConfig,
  ) => ClickHouseClient = createClickHouseClient,
) {
  return defineAdapter<ClickHouseContext, ClickHouseConfig>({
    metadata: {
      id: "clickhouse",
      name: "ClickHouse",
      version: "0.1.0",
      author: "DSUI",
      iconUrl: clickhouseIconUrl,
      description:
        "Explore ClickHouse databases, run SQL, and monitor active queries.",
    },
    connectionMethods: {
      structured: {
        label: "Host and port",
        description:
          "Cloud or self-hosted HTTP(S). HTTPS defaults to 8443; HTTP to 8123. Certificates are PEM text. Headers and settings are JSON objects.",
        schema: structuredSchema,
        contextIdleTimeoutMs: 300_000,
      },
      url: {
        label: "Connection URL",
        description:
          "HTTP(S) URL. Its path is a reverse-proxy prefix; choose the database separately. Do not use native TCP ports or URL query parameters.",
        schema: urlSchema,
        contextIdleTimeoutMs: 300_000,
      },
    },
    context: async (config) => {
      const client = createClient(config);
      try {
        await client.execute(
          "SELECT version() AS version, currentUser() AS user",
        );
        return { client, config };
      } catch (error) {
        await client.dispose();
        throw error;
      }
    },
    disposeContext: (ctx) => ctx.client.dispose(),
    latencyBudgetMs: 1000,
    health: clickhouseHealth,
    resources: catalogResources,
    actions,
    pages,
    signals: [querySucceeded, queryFailed],
  });
}
export const clickhouseAdapter = createClickHouseAdapter();
export default clickhouseAdapter;
