import {
  defineResource,
  pageInput,
  poll,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";

export const connections = defineResource({
  id: "connections",
  input: pageInput,
  query: async (input, ctx: AirflowContext) => {
    const { items, total } = await ctx.client.listConnectionPage(input);
    return {
      total,
      items: items.map((connection) => {
        const host = [connection.host, connection.port]
          .filter((part) => part !== null && part !== "")
          .join(":");
        return {
          ...connection,
          address: [connection.login, host].filter(Boolean).join("@"),
        };
      }),
    };
  },
  // Watched, so the list also refreshes after a change made in a modal.
  refresh: poll("30s"),
});

export const variables = defineResource({
  id: "variables",
  input: pageInput,
  query: async (input, ctx: AirflowContext) => {
    const { items, total } = await ctx.client.listVariablePage(input);
    return {
      total,
      items: items.map((variable) => ({
        ...variable,
        encryptedLabel: variable.isEncrypted ? "Encrypted" : "",
      })),
    };
  },
  refresh: poll("30s"),
});

export const pools = defineResource({
  id: "pools",
  input: pageInput,
  query: async (input, ctx: AirflowContext) => {
    const { items, total } = await ctx.client.listPoolPage(input);
    return {
      total,
      items: items.map((pool) => ({
        ...pool,
        openLabel: `${pool.openSlots} of ${pool.slots} open`,
        openTone: pool.openSlots > 0 ? "healthy" : "warning",
        usageLabel: `${pool.runningSlots} running · ${pool.queuedSlots} queued`,
      })),
    };
  },
  refresh: poll("30s"),
});

export const users = defineResource({
  id: "users",
  input: pageInput,
  query: async (input, ctx: AirflowContext) => {
    if (!ctx.client.supportsUserAdministration())
      return {
        total: 1,
        items: [
          {
            username: "Managed by the Airflow auth manager",
            name: "",
            email: "",
            active: true,
            roles: "Configure users and roles in Airflow 3's auth manager.",
            statusLabel: "",
            statusTone: "muted",
          },
        ],
      };
    const { items, total } = await ctx.client.listUserPage(input);
    return {
      total,
      items: items.map((user) => ({
        ...user,
        statusLabel: user.active ? "Active" : "Inactive",
        statusTone: user.active ? "healthy" : "muted",
      })),
    };
  },
});

export const eventLogs = defineResource({
  id: "event-logs",
  input: pageInput.extend({ event: z.string().max(100).default("") }),
  query: (input, ctx: AirflowContext) => ctx.client.listEventLogPage(input),
});
