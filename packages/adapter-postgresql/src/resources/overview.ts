import type { MeterData } from "@northgraindata/dsui-adapter-sdk";
import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type {
  PostgreSQLOverview,
  PostgreSQLSchemaTableCount,
} from "../client.js";
import type { PostgreSQLContext } from "../context.js";

export const overview = defineResource<PostgreSQLOverview, PostgreSQLContext>({
  id: "overview",
  query: (_, ctx) => ctx.client.overview(),
});

export const schemaTableCounts = defineResource<
  PostgreSQLSchemaTableCount[],
  PostgreSQLContext
>({
  id: "schema-table-counts",
  query: (_, ctx) => ctx.client.schemaTableCounts(),
});

export const schemaTableMeter = defineResource<MeterData, PostgreSQLContext>({
  id: "schema-table-meter",
  query: async (_, ctx) => {
    const counts = await ctx.client.schemaTableCounts();
    return {
      segments:
        counts.length > 0
          ? counts.map((entry) => ({
              label: entry.schema,
              value: entry.tables,
              tone: "info" as const,
            }))
          : [{ label: "No user tables", value: 0, tone: "muted" as const }],
      footer: "Tables by user schema",
    };
  },
});

export const connectionUsage = defineResource<MeterData, PostgreSQLContext>({
  id: "connection-usage",
  query: async (_, ctx) => {
    const data = await ctx.client.overview();
    return {
      segments: [
        { label: "Active", value: data.activeConnections, tone: "healthy" },
        {
          label: "Available",
          value: Math.max(data.maxConnections - data.activeConnections, 0),
          tone: "muted",
        },
      ],
      footer: `${data.activeConnections} of ${data.maxConnections} connections in use`,
    };
  },
});
