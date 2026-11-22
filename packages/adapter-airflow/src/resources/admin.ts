import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";

export const connections = defineResource({
  id: "connections",
  query: async (_, ctx: AirflowContext) =>
    (await ctx.client.listConnections()).map((connection) => {
      const host = [connection.host, connection.port]
        .filter((part) => part !== null && part !== "")
        .join(":");
      return {
        ...connection,
        address: [connection.login, host].filter(Boolean).join("@"),
      };
    }),
});

export const variables = defineResource({
  id: "variables",
  query: async (_, ctx: AirflowContext) =>
    (await ctx.client.listVariables()).map((variable) => ({
      ...variable,
      encryptedLabel: variable.isEncrypted ? "Encrypted" : "",
    })),
});

export const pools = defineResource({
  id: "pools",
  query: async (_, ctx: AirflowContext) =>
    (await ctx.client.listPools()).map((pool) => ({
      ...pool,
      openLabel: `${pool.openSlots} of ${pool.slots} open`,
      openTone: pool.openSlots > 0 ? "healthy" : "warning",
      usageLabel: `${pool.runningSlots} running · ${pool.queuedSlots} queued`,
    })),
});

export const users = defineResource({
  id: "users",
  query: async (_, ctx: AirflowContext) => {
    if (!ctx.client.supportsUserAdministration())
      return [
        {
          username: "Managed by the Airflow auth manager",
          name: "",
          email: "",
          active: true,
          roles: "Configure users and roles in Airflow 3's auth manager.",
        },
      ];
    return (await ctx.client.listUsers()).map((user) => ({
      ...user,
      statusLabel: user.active ? "Active" : "Inactive",
      statusTone: user.active ? "healthy" : "muted",
    }));
  },
});

export const eventLogs = defineResource({
  id: "event-logs",
  query: (_, ctx: AirflowContext) => ctx.client.listEventLogs(),
});
