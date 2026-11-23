import { z } from "zod";
export const configSchema = z.object({
  maxServices: z.number().int().min(1).max(5000).default(5000),
});
export type StatusConfig = z.infer<typeof configSchema>;
