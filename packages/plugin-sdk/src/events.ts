import { z } from "zod";

export const signalEventSchema = z.object({
  id: z.string(),
  signalId: z.string(),
  type: z.enum(["info", "success", "warning", "error"]),
  sourceType: z.string(),
  sourceId: z.string(),
  serviceId: z.string().optional(),
  payload: z.unknown(),
  origin: z
    .object({ pluginId: z.string(), runId: z.string().optional() })
    .optional(),
  occurredAt: z.string(),
});
export type PluginSignalEvent = z.infer<typeof signalEventSchema>;
export type PluginEventReadOptions = { cursor?: string; limit?: number };
export type PluginEventPage = {
  items: PluginSignalEvent[];
  cursor: string;
  hasMore: boolean;
};
