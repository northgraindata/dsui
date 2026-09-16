import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLActivityEntry } from "../client.js";
import type { PostgreSQLContext } from "../context.js";

export const activity = defineResource<
  z.ZodObject<{
    database: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
  }>,
  PostgreSQLActivityEntry[],
  PostgreSQLContext
>({
  id: "activity",
  input: z.object({
    database: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
  }),
  query: (filters, ctx) => ctx.client.listActivity(filters),
  refresh: poll("5s"),
});
