import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";

export const connections = defineResource({
  id: "connections",
  query: (_, ctx: AirflowContext) => ctx.client.listConnections(),
});

export const variables = defineResource({
  id: "variables",
  query: (_, ctx: AirflowContext) => ctx.client.listVariables(),
});

export const pools = defineResource({
  id: "pools",
  query: (_, ctx: AirflowContext) => ctx.client.listPools(),
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
    return ctx.client.listUsers();
  },
});

export const eventLogs = defineResource({
  id: "event-logs",
  query: (_, ctx: AirflowContext) => ctx.client.listEventLogs(),
});
