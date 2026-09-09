import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";

export const dagInput = z.object({ dagId: z.string().min(1) });

export const dags = defineResource({
  id: "dags",
  query: (_, ctx: AirflowContext) => ctx.client.listDags(),
  refresh: poll("30s"),
});

export const dagDetails = defineResource({
  id: "dag-details",
  input: dagInput,
  query: ({ dagId }, ctx: AirflowContext) => ctx.client.getDag(dagId),
  refresh: poll("30s"),
});

export const dagTasks = defineResource({
  id: "dag-tasks",
  input: dagInput,
  query: ({ dagId }, ctx: AirflowContext) => ctx.client.listDagTasks(dagId),
});
